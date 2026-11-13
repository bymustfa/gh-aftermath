import { describe, expect, it, vi } from "vitest";
import { executeOperations, parseOperations } from "../src/core/execute.js";
import { actionPath } from "../src/core/paths.js";
import type { RecoveryClient } from "../src/core/types.js";

function client(): RecoveryClient {
  return {
    redeliver: vi.fn(async () => undefined),
    cancelRun: vi.fn(async () => undefined),
    forceCancelRun: vi.fn(async () => undefined),
    rerun: vi.fn(async () => undefined),
  };
}

describe("recovery actions", () => {
  it("builds the official redeliver, cancel, force-cancel, and rerun paths", () => {
    expect(
      actionPath({ type: "redeliver", scope: "repo", owner: "acme", repo: "web", hookId: 3, deliveryId: 9 }).path,
    ).toBe("/repos/acme/web/hooks/3/deliveries/9/attempts");
    expect(actionPath({ type: "redeliver", scope: "org", org: "acme", hookId: 4, deliveryId: 8 }).path).toBe(
      "/orgs/acme/hooks/4/deliveries/8/attempts",
    );
    expect(actionPath({ type: "redeliver", scope: "app", deliveryId: 7 }).path).toBe(
      "/app/hook/deliveries/7/attempts",
    );
    expect(actionPath({ type: "cancel", owner: "acme", repo: "web", runId: 5 }).path).toBe(
      "/repos/acme/web/actions/runs/5/cancel",
    );
    expect(actionPath({ type: "force-cancel", owner: "acme", repo: "web", runId: 5 }).path).toBe(
      "/repos/acme/web/actions/runs/5/force-cancel",
    );
    expect(actionPath({ type: "rerun", owner: "acme", repo: "web", runId: 5 }).path).toBe(
      "/repos/acme/web/actions/runs/5/rerun",
    );
  });

  it("plans requests in dry-run mode and does not call GitHub", async () => {
    const github = client();
    const [record] = await executeOperations(
      [{ type: "redeliver", scope: "repo", owner: "acme", repo: "web", hookId: 3, deliveryId: 9 }],
      github,
      { dryRun: true, now: new Date("2026-11-09T19:00:00.000Z") },
    );
    expect(record?.dryRun).toBe(true);
    expect(record?.executed).toBe(false);
    expect(record?.ok).toBe(true);
    expect(record?.request.path).toContain("/attempts");
    expect(github.redeliver).not.toHaveBeenCalled();
  });

  it("executes each action and keeps going when one fails", async () => {
    const github = client();
    vi.mocked(github.redeliver).mockRejectedValueOnce(new Error("still down"));
    const records = await executeOperations(
      [
        { type: "redeliver", scope: "repo", owner: "acme", repo: "web", hookId: 3, deliveryId: 9 },
        { type: "force-cancel", owner: "acme", repo: "web", runId: 5 },
        { type: "rerun", owner: "acme", repo: "api", runId: 6 },
      ],
      github,
      { dryRun: false, concurrency: 1 },
    );
    expect(records.map((record) => record.ok)).toEqual([false, true, true]);
    expect(records[0]?.error).toBe("still down");
    expect(records[0]?.executed).toBe(true);
    expect(github.forceCancelRun).toHaveBeenCalledWith({ owner: "acme", repo: "web", runId: 5 });
    expect(github.rerun).toHaveBeenCalledWith({ owner: "acme", repo: "api", runId: 6 });
  });

  it("limits how many actions run at once", async () => {
    let active = 0;
    let max = 0;
    const github = client();
    vi.mocked(github.cancelRun).mockImplementation(async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    });
    await executeOperations(
      [1, 2, 3, 4, 5, 6].map((runId) => ({ type: "cancel" as const, owner: "acme", repo: "web", runId })),
      github,
      { dryRun: false, concurrency: 2 },
    );
    expect(max).toBeLessThanOrEqual(2);
    expect(github.cancelRun).toHaveBeenCalledTimes(6);
  });

  it("rejects a payload that is not a list of actions", () => {
    expect(() => parseOperations({ type: "cancel" })).toThrow(/list/);
    const operations = parseOperations([
      { type: "cancel", owner: "acme", repo: "web", runId: 5 },
    ]);
    expect(operations).toEqual([{ type: "cancel", owner: "acme", repo: "web", runId: 5 }]);
  });
});
