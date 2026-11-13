import { splitDeliveryPage, createdQualifier } from "../core/time.js";
import type {
  HookRef,
  RateLimitSnapshot,
  RawDelivery,
  RawRun,
  RecoveryClient,
  RedeliverTarget,
  RepoRef,
  RunTarget,
  ScanClient,
  TimeWindow,
} from "../core/types.js";
import { createGitHubClients, type GitHubAuth, type GitHubClients, type Logger, consoleLogger } from "./client.js";

export interface GitHubRequest {
  (route: string, parameters?: Record<string, string | number | boolean | undefined>): Promise<{
    data: unknown;
    status: number;
  }>;
}

export interface RequestGatewayOptions {
  request: GitHubRequest;
  appRequest?: GitHubRequest;
  perPage?: number;
  maxPages?: number;
  concurrency?: number;
}

const RUN_STATUSES = ["queued", "in_progress", "waiting", "pending", "requested"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function mapDelivery(
  value: unknown,
  scope: RawDelivery["scope"],
  hookId: number,
  place: { owner?: string; repo?: string; org?: string; targetUrl?: string },
): RawDelivery | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "number") return null;
  return {
    id: record.id,
    guid: text(record.guid),
    deliveredAt: typeof record.delivered_at === "string" ? record.delivered_at : null,
    status: text(record.status),
    statusCode: numberOrNull(record.status_code),
    event: text(record.event),
    action: typeof record.action === "string" ? record.action : null,
    redelivery: Boolean(record.redelivery),
    duration: numberOrNull(record.duration),
    hookId,
    scope,
    owner: place.owner,
    repo: place.repo,
    org: place.org,
    targetUrl: place.targetUrl,
  };
}

function mapHook(value: unknown, scope: HookRef["scope"], place: { owner?: string; repo?: string; org?: string }): HookRef | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "number") return null;
  const config = asRecord(record.config);
  return {
    id: record.id,
    scope,
    active: record.active !== false,
    events: asArray(record.events).filter((event): event is string => typeof event === "string"),
    targetUrl: text(config?.url),
    owner: place.owner,
    repo: place.repo,
    org: place.org,
  };
}

function mapRun(value: unknown, fallback: { owner?: string; repo?: string }): RawRun | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "number") return null;
  const repository = asRecord(record.repository);
  const ownerRecord = asRecord(repository?.owner);
  const owner = text(ownerRecord?.login, fallback.owner);
  const repo = text(repository?.name, fallback.repo);
  if (!owner || !repo) return null;
  return {
    id: record.id,
    name: text(record.name, "workflow"),
    displayTitle: text(record.display_title, text(record.name, "workflow")),
    status: text(record.status),
    conclusion: typeof record.conclusion === "string" ? record.conclusion : null,
    htmlUrl: text(record.html_url),
    createdAt: text(record.created_at),
    updatedAt: text(record.updated_at, text(record.created_at)),
    runStartedAt: typeof record.run_started_at === "string" ? record.run_started_at : null,
    event: text(record.event),
    headBranch: text(record.head_branch),
    owner,
    repo,
  };
}

async function mapLimit<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const current = next;
      next += 1;
      const item = items[current];
      if (item === undefined) return;
      results[current] = await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export function createRequestGateway(options: RequestGatewayOptions): ScanClient & RecoveryClient {
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? 20;
  const concurrency = options.concurrency ?? 4;
  const request = options.request;
  const appRequest = options.appRequest;

  async function listArray(
    route: string,
    parameters: Record<string, string | number | boolean | undefined>,
    which: GitHubRequest = request,
  ): Promise<unknown[]> {
    const rows: unknown[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await which(route, { ...parameters, per_page: perPage, page });
      const batch = asArray(response.data);
      rows.push(...batch);
      if (batch.length < perPage) break;
    }
    return rows;
  }

  async function listDeliveries(
    route: string,
    parameters: Record<string, string | number | boolean | undefined>,
    window: TimeWindow,
    map: (value: unknown) => RawDelivery | null,
    which: GitHubRequest = request,
  ): Promise<RawDelivery[]> {
    const kept: RawDelivery[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await which(route, { ...parameters, per_page: perPage, page });
      const mapped = asArray(response.data)
        .map((value) => map(value))
        .filter((value): value is RawDelivery => value !== null);
      const split = splitDeliveryPage(mapped, window);
      kept.push(...split.keep);
      if (split.stop || mapped.length < perPage) break;
    }
    return kept;
  }

  async function listRunsFor(
    route: string,
    parameters: Record<string, string | number | boolean | undefined>,
    fallback: { owner?: string; repo?: string },
  ): Promise<RawRun[]> {
    const runs: RawRun[] = [];
    const seen = new Set<number>();
    for (const status of RUN_STATUSES) {
      for (let page = 1; page <= maxPages; page += 1) {
        const response = await request(route, { ...parameters, status, per_page: perPage, page });
        const body = asRecord(response.data);
        const batch = asArray(body?.workflow_runs ?? response.data);
        for (const value of batch) {
          const run = mapRun(value, fallback);
          if (!run || seen.has(run.id)) continue;
          seen.add(run.id);
          runs.push(run);
        }
        if (batch.length < perPage) break;
      }
    }
    return runs;
  }

  return {
    async listRepos(org) {
      const rows = await listArray("GET /orgs/{org}/repos", { org, type: "all" });
      const repos: RepoRef[] = [];
      for (const row of rows) {
        const record = asRecord(row);
        if (!record || record.archived === true || record.disabled === true) continue;
        const owner = asRecord(record.owner);
        const name = text(record.name);
        const login = text(owner?.login, org);
        if (!name) continue;
        repos.push({ owner: login, name });
      }
      return repos;
    },

    async listOrgHooks(org) {
      const rows = await listArray("GET /orgs/{org}/hooks", { org });
      return rows
        .map((row) => mapHook(row, "org", { org }))
        .filter((hook): hook is HookRef => hook !== null);
    },

    async listRepoHooks(owner, repo) {
      const rows = await listArray("GET /repos/{owner}/{repo}/hooks", { owner, repo });
      return rows
        .map((row) => mapHook(row, "repo", { owner, repo }))
        .filter((hook): hook is HookRef => hook !== null);
    },

    listOrgDeliveries(org, hookId, window) {
      return listDeliveries("GET /orgs/{org}/hooks/{hook_id}/deliveries", { org, hook_id: hookId }, window, (value) =>
        mapDelivery(value, "org", hookId, { org }),
      );
    },

    listRepoDeliveries(owner, repo, hookId, window) {
      return listDeliveries(
        "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries",
        { owner, repo, hook_id: hookId },
        window,
        (value) => mapDelivery(value, "repo", hookId, { owner, repo }),
      );
    },

    async listAppDeliveries(window) {
      if (!appRequest) {
        throw new Error("GitHub App id and private key are required to read app webhook deliveries.");
      }
      return listDeliveries(
        "GET /app/hook/deliveries",
        {},
        window,
        (value) => mapDelivery(value, "app", 0, {}),
        appRequest,
      );
    },

    async listWorkflowRuns(org, window) {
      const created = createdQualifier(window);
      try {
        return await listRunsFor("GET /orgs/{org}/actions/runs", { org, created }, { owner: org });
      } catch (error) {
        if (statusOf(error) !== 404) throw error;
      }
      const repos = await this.listRepos(org);
      const groups = await mapLimit(repos, concurrency, async (repo) => {
        try {
          return await listRunsFor(
            "GET /repos/{owner}/{repo}/actions/runs",
            { owner: repo.owner, repo: repo.name, created },
            repo,
          );
        } catch (error) {
          if (statusOf(error) === 404) return [];
          throw error;
        }
      });
      const seen = new Set<number>();
      const runs: RawRun[] = [];
      for (const group of groups) {
        for (const run of group) {
          if (seen.has(run.id)) continue;
          seen.add(run.id);
          runs.push(run);
        }
      }
      return runs;
    },

    async rateLimit() {
      try {
        const response = await request("GET /rate_limit");
        const body = asRecord(response.data);
        const resources = asRecord(body?.resources);
        const core = asRecord(resources?.core);
        if (!core || typeof core.limit !== "number" || typeof core.remaining !== "number") return null;
        const reset = typeof core.reset === "number" ? new Date(core.reset * 1000).toISOString() : "";
        const snapshot: RateLimitSnapshot = { limit: core.limit, remaining: core.remaining, reset };
        return snapshot;
      } catch {
        return null;
      }
    },

    async redeliver(target: RedeliverTarget) {
      if (target.scope === "repo") {
        await request("POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts", {
          owner: target.owner,
          repo: target.repo,
          hook_id: target.hookId,
          delivery_id: target.deliveryId,
        });
        return;
      }
      if (target.scope === "org") {
        await request("POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts", {
          org: target.org,
          hook_id: target.hookId,
          delivery_id: target.deliveryId,
        });
        return;
      }
      const which = appRequest ?? request;
      await which("POST /app/hook/deliveries/{delivery_id}/attempts", {
        delivery_id: target.deliveryId,
      });
    },

    async cancelRun(target: RunTarget) {
      await request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel", {
        owner: target.owner,
        repo: target.repo,
        run_id: target.runId,
      });
    },

    async forceCancelRun(target: RunTarget) {
      await request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel", {
        owner: target.owner,
        repo: target.repo,
        run_id: target.runId,
      });
    },

    async rerun(target: RunTarget) {
      await request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun", {
        owner: target.owner,
        repo: target.repo,
        run_id: target.runId,
      });
    },
  };
}

export function createGitHubGateway(
  auth: GitHubAuth,
  options: { log?: Logger; perPage?: number; maxPages?: number; concurrency?: number } = {},
): ScanClient & RecoveryClient {
  const log = options.log ?? consoleLogger;
  const clients = createGitHubClients(auth, log);
  if (!clients.user) {
    throw new Error("Organization scans need GITHUB_TOKEN or a GitHub App installation id.");
  }
  const bind =
    (client: NonNullable<GitHubClients["user"]>): GitHubRequest =>
    (route, parameters) =>
      client.request(route, parameters ?? {});
  return createRequestGateway({
    request: bind(clients.user),
    ...(clients.app ? { appRequest: bind(clients.app) } : {}),
    perPage: options.perPage,
    maxPages: options.maxPages,
    concurrency: options.concurrency,
  });
}
