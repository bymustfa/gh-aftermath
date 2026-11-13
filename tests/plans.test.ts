import { describe, expect, it } from "vitest";
import { applyDryRunBatch, assertCompatibleRunPlans, batchSummary, conflictingRunPlans } from "../src/core/plans.js";
import type { ActionRecord } from "../src/core/types.js";

function record(partial: Pick<ActionRecord, "id" | "type" | "request"> & Partial<ActionRecord>): ActionRecord {
  return {
    label: partial.type,
    dryRun: true,
    executed: false,
    ok: true,
    at: "2026-11-13T12:00:00.000Z",
    ...partial,
  };
}

describe("dry-run plans", () => {
  it("summarizes only the actions it is given", () => {
    expect(
      batchSummary([
        record({
          id: "1",
          type: "cancel",
          request: { method: "POST", path: "/repos/acme/web/actions/runs/5/cancel" },
        }),
        record({
          id: "2",
          type: "rerun",
          dryRun: false,
          executed: true,
          request: { method: "POST", path: "/repos/acme/web/actions/runs/6/rerun" },
        }),
        record({
          id: "3",
          type: "force-cancel",
          dryRun: false,
          executed: true,
          ok: false,
          error: "nope",
          request: { method: "POST", path: "/repos/acme/web/actions/runs/7/force-cancel" },
        }),
      ]),
    ).toEqual({ planned: 1, executed: 2, succeeded: 1, failed: 1 });
  });

  it("rejects a batch that plans several verbs for the same run", () => {
    const operations = [
      { type: "cancel" as const, owner: "acme", repo: "web", runId: 5 },
      { type: "force-cancel" as const, owner: "acme", repo: "web", runId: 5 },
      { type: "rerun" as const, owner: "acme", repo: "web", runId: 5 },
      { type: "cancel" as const, owner: "acme", repo: "api", runId: 6 },
    ];
    expect(conflictingRunPlans(operations)).toEqual([
      "Run acme/web #5 cannot be planned for cancel, force-cancel, and re-run at the same time. Choose one of cancel, force-cancel, or re-run.",
    ]);
    expect(() => assertCompatibleRunPlans(operations)).toThrow(/acme\/web #5/);
    expect(conflictingRunPlans([{ type: "cancel", owner: "acme", repo: "web", runId: 5 }])).toEqual([]);
  });

  it("replaces the previous dry-run with this batch and flags a changed verb", () => {
    const earlier = [
      record({
        id: "old-cancel",
        type: "cancel",
        request: { method: "POST", path: "/repos/acme/web/actions/runs/5/cancel" },
      }),
      record({
        id: "old-redeliver",
        type: "redeliver",
        request: { method: "POST", path: "/repos/acme/web/hooks/3/deliveries/9/attempts" },
      }),
      record({
        id: "sent",
        type: "rerun",
        dryRun: false,
        executed: true,
        request: { method: "POST", path: "/repos/acme/api/actions/runs/8/rerun" },
      }),
    ];
    const batch = [
      record({
        id: "new-force",
        type: "force-cancel",
        request: { method: "POST", path: "/repos/acme/web/actions/runs/5/force-cancel" },
      }),
    ];
    const merged = applyDryRunBatch(earlier, batch);
    expect(merged.actions.map((action) => action.id)).toEqual(["sent", "new-force"]);
    expect(merged.conflicts).toEqual([
      "Run acme/web #5 was planned for cancel and this batch plans force-cancel. A run cannot be planned for both at the same time, so the earlier cancel plan was dropped.",
    ]);
    expect(batchSummary(batch).planned).toBe(1);
    expect(batchSummary(merged.actions).planned).toBe(1);
  });
});
