import {
  credentialError,
  isCredentialFailure,
  isHookPermissionFailure,
  httpStatus,
  orgHookPermissionError,
  repoHookPermissionError,
} from "./access.js";
import { classifyDelivery } from "./deliveries.js";
import { mapPool } from "./pool.js";
import { stuckReason } from "./runs.js";
import { isWithinWindow, windowDurationMs } from "./time.js";
import type {
  FlaggedDelivery,
  FlaggedRun,
  RawDelivery,
  ScanClient,
  ScanResult,
  TimeWindow,
} from "./types.js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export interface ScanInput {
  org: string;
  window: TimeWindow;
  includeApp: boolean;
  now?: Date;
  queuedThresholdMs: number;
  inProgressThresholdMs: number;
  concurrency?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function deliveryInWindow(delivery: RawDelivery, window: TimeWindow): boolean {
  return isWithinWindow(delivery.deliveredAt, window);
}

export async function scanOrganization(client: ScanClient, input: ScanInput): Promise<ScanResult> {
  if (client.verifyAccess) {
    await client.verifyAccess({ org: input.org, includeApp: input.includeApp });
  }

  const warnings: string[] = [];
  const now = input.now ?? new Date();
  const concurrency = input.concurrency ?? 4;
  let credential: ReturnType<typeof credentialError> | null = null;
  if (windowDurationMs(input.window) > FOURTEEN_DAYS_MS) {
    warnings.push(
      "This window is longer than 14 days. GitHub only keeps recent webhook deliveries, and the scan will make more API calls.",
    );
  }

  const [reposResult, orgHooksResult] = await Promise.allSettled([
    client.listRepos(input.org),
    client.listOrgHooks(input.org),
  ]);

  const repos = reposResult.status === "fulfilled" ? reposResult.value : [];
  const orgHooks = orgHooksResult.status === "fulfilled" ? orgHooksResult.value : [];
  if (reposResult.status === "rejected") {
    if (isCredentialFailure(reposResult.reason)) throw credentialError();
    warnings.push(`Could not list repositories: ${errorMessage(reposResult.reason)}`);
  }
  if (orgHooksResult.status === "rejected") {
    if (isCredentialFailure(orgHooksResult.reason)) throw credentialError();
    if (isHookPermissionFailure(orgHooksResult.reason)) {
      throw orgHookPermissionError(httpStatus(orgHooksResult.reason) ?? 403);
    }
    warnings.push(`Could not list organization webhooks: ${errorMessage(orgHooksResult.reason)}`);
  }

  const deliveries: RawDelivery[] = [];

  const repoHookDenials: number[] = [];
  let repoHookLists = 0;

  const collectOrg = mapPool(orgHooks, concurrency, async (hook) => {
    try {
      const found = await client.listOrgDeliveries(input.org, hook.id, input.window);
      return found.map((delivery) => ({ ...delivery, targetUrl: delivery.targetUrl || hook.targetUrl }));
    } catch (error) {
      if (isCredentialFailure(error)) credential = credential ?? credentialError();
      warnings.push(`Organization hook ${hook.id}: ${errorMessage(error)}`);
      return [];
    }
  });

  const collectRepos = mapPool(repos, concurrency, async (repo) => {
    try {
      const hooks = await client.listRepoHooks(repo.owner, repo.name);
      repoHookLists += 1;
      const found: RawDelivery[] = [];
      for (const hook of hooks) {
        try {
          const page = await client.listRepoDeliveries(repo.owner, repo.name, hook.id, input.window);
          for (const delivery of page) {
            found.push({ ...delivery, targetUrl: delivery.targetUrl || hook.targetUrl });
          }
        } catch (error) {
          if (isCredentialFailure(error)) credential = credential ?? credentialError();
          warnings.push(`${repo.owner}/${repo.name} hook ${hook.id}: ${errorMessage(error)}`);
        }
      }
      return { found, hooks: hooks.length };
    } catch (error) {
      if (isCredentialFailure(error)) credential = credential ?? credentialError();
      else if (isHookPermissionFailure(error)) repoHookDenials.push(httpStatus(error) ?? 403);
      warnings.push(`${repo.owner}/${repo.name}: ${errorMessage(error)}`);
      return { found: [] as RawDelivery[], hooks: 0 };
    }
  });

  const collectApp = input.includeApp
    ? client.listAppDeliveries(input.window).catch((error: unknown) => {
        if (isCredentialFailure(error)) credential = credential ?? credentialError();
        warnings.push(`GitHub App deliveries: ${errorMessage(error)}`);
        return [] as RawDelivery[];
      })
    : Promise.resolve([] as RawDelivery[]);

  const collectRuns = client.listWorkflowRuns(input.org, input.window).catch((error: unknown) => {
    if (isCredentialFailure(error)) credential = credential ?? credentialError();
    warnings.push(`Workflow runs: ${errorMessage(error)}`);
    return [];
  });

  const [orgDeliveries, repoDeliveries, appDeliveries, runs] = await Promise.all([
    collectOrg,
    collectRepos,
    collectApp,
    collectRuns,
  ]);

  if (credential) throw credential;
  if (repos.length > 0 && repoHookLists === 0 && repoHookDenials.length === repos.length) {
    const label = [...new Set(repoHookDenials)].join(" or ");
    throw repoHookPermissionError(label);
  }

  for (const group of orgDeliveries) deliveries.push(...group);
  let hookCount = orgHooks.length;
  for (const group of repoDeliveries) {
    deliveries.push(...group.found);
    hookCount += group.hooks;
  }
  deliveries.push(...appDeliveries);

  const seen = deliveries.filter((delivery) => deliveryInWindow(delivery, input.window));
  const flaggedDeliveries: FlaggedDelivery[] = [];
  for (const delivery of seen) {
    const classification = classifyDelivery(delivery);
    if (!classification.failed || !classification.reason) continue;
    flaggedDeliveries.push({ ...delivery, reason: classification.reason });
  }
  flaggedDeliveries.sort((a, b) => {
    const left = a.deliveredAt ? Date.parse(a.deliveredAt) : 0;
    const right = b.deliveredAt ? Date.parse(b.deliveredAt) : 0;
    return right - left;
  });

  const stuckOptions = {
    now,
    queuedThresholdMs: input.queuedThresholdMs,
    inProgressThresholdMs: input.inProgressThresholdMs,
  };
  const flaggedRuns: FlaggedRun[] = [];
  for (const run of runs) {
    const reason = stuckReason(run, input.window, stuckOptions);
    if (!reason) continue;
    flaggedRuns.push({ ...run, reason });
  }
  flaggedRuns.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return {
    org: input.org,
    window: input.window,
    scannedAt: now.toISOString(),
    deliveries: flaggedDeliveries,
    runs: flaggedRuns,
    warnings,
    counts: {
      repositories: repos.length,
      hooks: hookCount,
      deliveriesSeen: seen.length,
      failedDeliveries: flaggedDeliveries.length,
      stuckRuns: flaggedRuns.length,
    },
  };
}
