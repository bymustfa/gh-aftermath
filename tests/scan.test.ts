import { describe, expect, it } from "vitest";
import { scanOrganization } from "../src/core/scan.js";
import type { RawDelivery, RawRun, ScanClient } from "../src/core/types.js";

const window = {
  from: "2026-11-09T14:00:00.000Z",
  to: "2026-11-09T18:30:00.000Z",
};

function delivery(partial: Partial<RawDelivery> & Pick<RawDelivery, "id" | "deliveredAt" | "statusCode">): RawDelivery {
  return {
    guid: String(partial.id),
    status: partial.statusCode && partial.statusCode >= 400 ? "failed" : "OK",
    event: "push",
    action: null,
    redelivery: false,
    duration: 1,
    hookId: 1,
    scope: "repo",
    owner: "acme",
    repo: "web",
    ...partial,
  };
}

function run(partial: Partial<RawRun> & Pick<RawRun, "id" | "status" | "createdAt">): RawRun {
  return {
    name: "CI",
    displayTitle: "CI",
    conclusion: null,
    htmlUrl: "",
    updatedAt: partial.createdAt,
    runStartedAt: null,
    event: "push",
    headBranch: "main",
    owner: "acme",
    repo: "web",
    ...partial,
  };
}

function client(overrides: Partial<ScanClient> = {}): ScanClient {
  return {
    listRepos: async () => [
      { owner: "acme", name: "web" },
      { owner: "acme", name: "api" },
    ],
    listOrgHooks: async () => [{ id: 7, scope: "org", active: true, events: ["team"], targetUrl: "https://hooks.example", org: "acme" }],
    listRepoHooks: async (_owner, repo) =>
      repo === "api"
        ? Promise.reject(new Error("403"))
        : [{ id: 3, scope: "repo", active: true, events: ["push"], targetUrl: "https://web.example", owner: "acme", repo: "web" }],
    listOrgDeliveries: async () => [
      delivery({ id: 1, deliveredAt: "2026-11-09T15:00:00.000Z", statusCode: 504, scope: "org", org: "acme", hookId: 7 }),
    ],
    listRepoDeliveries: async () => [
      delivery({ id: 2, deliveredAt: "2026-11-09T15:10:00.000Z", statusCode: 200, status: "OK" }),
      delivery({ id: 3, deliveredAt: "2026-11-09T15:12:00.000Z", statusCode: 0, status: "failed" }),
      delivery({ id: 4, deliveredAt: "2026-11-08T15:12:00.000Z", statusCode: 503 }),
      delivery({ id: 5, deliveredAt: null, statusCode: 0, status: "failed" }),
    ],
    listAppDeliveries: async () => [
      delivery({ id: 6, deliveredAt: "2026-11-09T15:20:00.000Z", statusCode: 500, scope: "app", hookId: 0, owner: undefined, repo: undefined }),
    ],
    listWorkflowRuns: async () => [
      run({ id: 10, status: "queued", createdAt: "2026-11-09T15:00:00.000Z" }),
      run({ id: 11, status: "queued", createdAt: "2026-11-09T18:25:00.000Z" }),
      run({ id: 12, status: "in_progress", createdAt: "2026-11-09T14:10:00.000Z", runStartedAt: "2026-11-09T14:10:00.000Z" }),
      run({ id: 13, status: "in_progress", createdAt: "2026-11-09T18:20:00.000Z", runStartedAt: "2026-11-09T18:20:00.000Z" }),
      run({ id: 14, status: "completed", createdAt: "2026-11-09T15:00:00.000Z" }),
    ],
    rateLimit: async () => null,
    ...overrides,
  };
}

describe("organization scan", () => {
  it("keeps failed deliveries and stuck runs inside the window", async () => {
    const result = await scanOrganization(client(), {
      org: "acme",
      window,
      includeApp: true,
      now: new Date("2026-11-09T18:30:00.000Z"),
      queuedThresholdMs: 10 * 60 * 1000,
      inProgressThresholdMs: 60 * 60 * 1000,
      concurrency: 2,
    });
    expect(result.deliveries.map((delivery) => delivery.id).sort((a, b) => a - b)).toEqual([1, 3, 5, 6]);
    expect(result.deliveries.find((delivery) => delivery.id === 3)?.reason).toBe("missing_response");
    expect(result.runs.map((run) => run.id).sort((a, b) => a - b)).toEqual([10, 12]);
    expect(result.counts.failedDeliveries).toBe(4);
    expect(result.counts.stuckRuns).toBe(2);
    expect(result.counts.repositories).toBe(2);
    expect(result.warnings.some((warning) => warning.includes("acme/api"))).toBe(true);
    expect(result.counts.hooks).toBe(2);
  });

  it("can skip GitHub App deliveries", async () => {
    const result = await scanOrganization(client(), {
      org: "acme",
      window,
      includeApp: false,
      now: new Date("2026-11-09T18:30:00.000Z"),
      queuedThresholdMs: 10 * 60 * 1000,
      inProgressThresholdMs: 60 * 60 * 1000,
    });
    expect(result.deliveries.some((delivery) => delivery.scope === "app")).toBe(false);
  });
});
