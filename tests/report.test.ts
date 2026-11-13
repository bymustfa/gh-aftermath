import { describe, expect, it } from "vitest";
import { buildReport, reportToJson, reportToMarkdown } from "../src/core/report.js";
import type { ActionRecord, ScanResult } from "../src/core/types.js";

const scan: ScanResult = {
  org: "northwind",
  window: { from: "2026-11-09T14:00:00.000Z", to: "2026-11-09T18:30:00.000Z" },
  scannedAt: "2026-11-09T19:00:00.000Z",
  warnings: [],
  counts: { repositories: 5, hooks: 5, deliveriesSeen: 12, failedDeliveries: 1, stuckRuns: 1 },
  deliveries: [
    {
      id: 501,
      guid: "guid",
      deliveredAt: "2026-11-09T15:02:12.000Z",
      status: "failed",
      statusCode: 503,
      event: "push",
      action: null,
      redelivery: false,
      duration: 5,
      hookId: 11,
      scope: "repo",
      owner: "northwind",
      repo: "checkout-api",
      reason: "http_error",
    },
  ],
  runs: [
    {
      id: 1001,
      name: "CI",
      displayTitle: "Fix tax rounding",
      status: "queued",
      conclusion: null,
      htmlUrl: "https://github.com/northwind/checkout-api/actions/runs/1001",
      createdAt: "2026-11-09T15:05:00.000Z",
      updatedAt: "2026-11-09T15:05:00.000Z",
      runStartedAt: null,
      event: "push",
      headBranch: "main",
      owner: "northwind",
      repo: "checkout-api",
      reason: "queued",
    },
  ],
};

const planned: ActionRecord = {
  id: "1",
  type: "redeliver",
  label: "Redeliver northwind/checkout-api delivery 501",
  request: { method: "POST", path: "/repos/northwind/checkout-api/hooks/11/deliveries/501/attempts" },
  dryRun: true,
  executed: false,
  ok: true,
  at: "2026-11-09T19:01:00.000Z",
};

describe("reports", () => {
  it("writes a dry-run markdown report with the requests that would be sent", () => {
    const report = buildReport({
      version: "0.1.0",
      demo: true,
      org: "northwind",
      scan,
      actions: [planned],
      generatedAt: new Date("2026-11-09T19:01:00.000Z"),
    });
    expect(report.mode).toBe("dry-run");
    expect(report.counts.planned).toBe(1);
    expect(report.counts.executed).toBe(0);
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain("# gh-aftermath report");
    expect(markdown).toContain("Mode: dry-run");
    expect(markdown).toContain("northwind/checkout-api");
    expect(markdown).toContain("POST /repos/northwind/checkout-api/hooks/11/deliveries/501/attempts");
    expect(markdown).toContain("planned");
    expect(markdown).not.toMatch(/ghp_|github_pat_|BEGIN .*PRIVATE KEY/);
    const json = JSON.parse(reportToJson(report)) as { mode: string; actions: { dryRun: boolean }[] };
    expect(json.mode).toBe("dry-run");
    expect(json.actions[0]?.dryRun).toBe(true);
  });

  it("counts executed successes and failures separately from plans", () => {
    const report = buildReport({
      version: "0.1.0",
      demo: false,
      org: "northwind",
      scan,
      actions: [
        planned,
        { ...planned, id: "2", dryRun: false, executed: true, ok: true },
        { ...planned, id: "3", dryRun: false, executed: true, ok: false, error: "403" },
      ],
    });
    expect(report.mode).toBe("mixed");
    expect(report.counts).toMatchObject({ planned: 1, executed: 2, succeeded: 1, failed: 1 });
  });
});
