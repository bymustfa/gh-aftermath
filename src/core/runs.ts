import { isWithinWindow } from "./time.js";
import type { RawRun, StuckOptions, StuckReason, TimeWindow } from "./types.js";

const QUEUED_STATUSES = new Set(["queued", "waiting", "pending", "requested"]);

export function stuckReason(
  run: Pick<RawRun, "status" | "createdAt" | "runStartedAt">,
  window: TimeWindow,
  options: StuckOptions,
): StuckReason | null {
  const status = run.status.trim().toLowerCase();
  if (QUEUED_STATUSES.has(status)) {
    if (!isWithinWindow(run.createdAt, window)) return null;
    const age = options.now.getTime() - Date.parse(run.createdAt);
    if (!Number.isFinite(age) || age < options.queuedThresholdMs) return null;
    return "queued";
  }
  if (status === "in_progress") {
    const started = run.runStartedAt ?? run.createdAt;
    if (!isWithinWindow(started, window)) return null;
    const age = options.now.getTime() - Date.parse(started);
    if (!Number.isFinite(age) || age < options.inProgressThresholdMs) return null;
    return "in_progress";
  }
  return null;
}
