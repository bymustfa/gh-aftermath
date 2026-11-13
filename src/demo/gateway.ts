import { isWithinWindow } from "../core/time.js";
import type {
  RateLimitSnapshot,
  RawDelivery,
  RawRun,
  RecoveryClient,
  RedeliverTarget,
  RunTarget,
  ScanClient,
  TimeWindow,
} from "../core/types.js";
import { DEMO_ORG, createDemoSnapshot } from "./fixtures.js";

export interface DemoGatewayOptions {
  org?: string;
  now?: Date;
}

export function createDemoGateway(options: DemoGatewayOptions = {}): ScanClient & RecoveryClient {
  const org = options.org ?? DEMO_ORG;
  const state = createDemoSnapshot(org, options.now ?? new Date());

  function requireDelivery(id: number): RawDelivery {
    const delivery = state.deliveries.find((item) => item.id === id);
    if (!delivery) throw new Error(`Delivery ${id} is not in the demo workspace.`);
    return delivery;
  }

  return {
    async listRepos() {
      return state.repos.map((repo) => ({ ...repo }));
    },
    async listOrgHooks() {
      return state.hooks.filter((hook) => hook.scope === "org").map((hook) => ({ ...hook, events: [...hook.events] }));
    },
    async listRepoHooks(owner, repo) {
      return state.hooks
        .filter((hook) => hook.scope === "repo" && hook.owner === owner && hook.repo === repo)
        .map((hook) => ({ ...hook, events: [...hook.events] }));
    },
    async listOrgDeliveries(_org, hookId, window: TimeWindow) {
      return state.deliveries
        .filter(
          (delivery) =>
            delivery.scope === "org" && delivery.hookId === hookId && isWithinWindow(delivery.deliveredAt, window),
        )
        .map((delivery) => ({ ...delivery }));
    },
    async listRepoDeliveries(owner, repo, hookId, window) {
      return state.deliveries
        .filter(
          (delivery) =>
            delivery.scope === "repo" &&
            delivery.hookId === hookId &&
            delivery.owner === owner &&
            delivery.repo === repo &&
            isWithinWindow(delivery.deliveredAt, window),
        )
        .map((delivery) => ({ ...delivery }));
    },
    async listAppDeliveries(window) {
      return state.deliveries
        .filter((delivery) => delivery.scope === "app" && isWithinWindow(delivery.deliveredAt, window))
        .map((delivery) => ({ ...delivery }));
    },
    async listWorkflowRuns(_org, window) {
      const now = new Date();
      const fresh = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
      return state.runs.flatMap((run) => {
        const next: RawRun = run.id === 1006 ? { ...run, createdAt: fresh, updatedAt: fresh, runStartedAt: fresh } : { ...run };
        const stamp = next.runStartedAt || next.createdAt;
        return isWithinWindow(stamp, window) ? [next] : [];
      });
    },
    async rateLimit(): Promise<RateLimitSnapshot> {
      return {
        limit: 5000,
        remaining: 4812,
        reset: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
      };
    },
    async redeliver(target: RedeliverTarget) {
      const delivery = requireDelivery(target.deliveryId);
      if (delivery.scope !== target.scope) {
        throw new Error(`Delivery ${target.deliveryId} is a ${delivery.scope} webhook, not ${target.scope}.`);
      }
      delivery.status = "OK";
      delivery.statusCode = 200;
      delivery.redelivery = true;
      delivery.duration = 0.2;
      if (!delivery.deliveredAt) delivery.deliveredAt = new Date().toISOString();
    },
    async cancelRun(target: RunTarget) {
      const run = state.runs.find((item) => item.id === target.runId && item.owner === target.owner && item.repo === target.repo);
      if (!run) throw new Error(`Workflow run ${target.runId} was not found.`);
      run.status = "completed";
      run.conclusion = "cancelled";
      run.updatedAt = new Date().toISOString();
    },
    async forceCancelRun(target: RunTarget) {
      const run = state.runs.find((item) => item.id === target.runId && item.owner === target.owner && item.repo === target.repo);
      if (!run) throw new Error(`Workflow run ${target.runId} was not found.`);
      run.status = "completed";
      run.conclusion = "cancelled";
      run.updatedAt = new Date().toISOString();
    },
    async rerun(target: RunTarget) {
      const run = state.runs.find((item) => item.id === target.runId && item.owner === target.owner && item.repo === target.repo);
      if (!run) throw new Error(`Workflow run ${target.runId} was not found.`);
      const stamp = new Date().toISOString();
      run.status = "queued";
      run.conclusion = null;
      run.createdAt = stamp;
      run.updatedAt = stamp;
      run.runStartedAt = null;
    },
  };
}
