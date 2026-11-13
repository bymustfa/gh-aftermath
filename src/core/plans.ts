import type { ActionRecord, Operation } from "./types.js";

export interface BatchSummary {
  planned: number;
  executed: number;
  succeeded: number;
  failed: number;
}

const RUN_PLAN = /^\/repos\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\//;

export function batchSummary(actions: readonly ActionRecord[]): BatchSummary {
  let planned = 0;
  let executed = 0;
  let succeeded = 0;
  let failed = 0;
  for (const action of actions) {
    if (action.dryRun && action.ok) planned += 1;
    if (action.executed) executed += 1;
    if (action.executed && action.ok) succeeded += 1;
    if (!action.ok) failed += 1;
  }
  return { planned, executed, succeeded, failed };
}

function verb(type: string): string {
  return type === "rerun" ? "re-run" : type;
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatRun(owner: string, repo: string, runId: number | string): string {
  return `${owner}/${repo} #${runId}`;
}

export function conflictingRunPlans(operations: readonly Operation[]): string[] {
  const grouped = new Map<string, { owner: string; repo: string; runId: number; types: string[] }>();
  for (const operation of operations) {
    if (operation.type === "redeliver") continue;
    const key = `${operation.owner}/${operation.repo}#${operation.runId}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        owner: operation.owner,
        repo: operation.repo,
        runId: operation.runId,
        types: [verb(operation.type)],
      });
      continue;
    }
    const label = verb(operation.type);
    if (!existing.types.includes(label)) existing.types.push(label);
  }
  const messages: string[] = [];
  for (const group of grouped.values()) {
    if (group.types.length < 2) continue;
    messages.push(
      `Run ${formatRun(group.owner, group.repo, group.runId)} cannot be planned for ${joinList(group.types)} at the same time. Choose one of cancel, force-cancel, or re-run.`,
    );
  }
  return messages;
}

export function assertCompatibleRunPlans(operations: readonly Operation[]): void {
  const messages = conflictingRunPlans(operations);
  if (messages.length > 0) throw new Error(messages.join(" "));
}

function runPlanKey(action: ActionRecord): string | null {
  const match = RUN_PLAN.exec(action.request.path);
  if (!match) return null;
  return `${match[1]}/${match[2]}#${match[3]}`;
}

export interface DryRunMerge {
  actions: ActionRecord[];
  conflicts: string[];
}

/**
 * A dry-run describes only the batch just submitted. Earlier unexecuted
 * dry-run plans are replaced. A different verb for the same run is flagged
 * and the earlier plan is dropped, so cancel, re-run, and force-cancel
 * cannot stay planned together.
 */
export function applyDryRunBatch(existing: readonly ActionRecord[], batch: readonly ActionRecord[]): DryRunMerge {
  const previous = new Map<string, ActionRecord>();
  for (const action of existing) {
    if (!action.dryRun || action.executed) continue;
    const key = runPlanKey(action);
    if (key) previous.set(key, action);
  }
  const conflicts: string[] = [];
  for (const action of batch) {
    const key = runPlanKey(action);
    if (!key) continue;
    const earlier = previous.get(key);
    if (!earlier || earlier.type === action.type) continue;
    const match = RUN_PLAN.exec(action.request.path);
    const run = match ? formatRun(match[1] ?? "", match[2] ?? "", match[3] ?? "") : key;
    conflicts.push(
      `Run ${run} was planned for ${verb(earlier.type)} and this batch plans ${verb(action.type)}. A run cannot be planned for both at the same time, so the earlier ${verb(earlier.type)} plan was dropped.`,
    );
  }
  const kept = existing.filter((action) => !action.dryRun || action.executed);
  return { actions: [...kept, ...batch], conflicts };
}
