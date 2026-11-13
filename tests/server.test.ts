import { describe, expect, it } from "vitest";
import { credentialError } from "../src/core/access.js";
import { createDemoGateway } from "../src/demo/gateway.js";
import { createApp } from "../src/server.js";
import type { RecoveryClient, ScanClient } from "../src/core/types.js";

const clock = () => new Date("2026-11-13T12:00:00.000Z");

function app(org = "northwind") {
  return createApp({
    demo: true,
    org,
    version: "0.1.0",
    concurrency: 4,
    gateway: createDemoGateway({ org: "northwind" }),
    clock,
    includeAppDefault: true,
  });
}

async function scan(application = app()) {
  const response = await application.request("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      org: "northwind",
      from: "2026-11-09T09:23",
      to: "2026-11-09T11:40",
      queuedMinutes: 10,
      inProgressMinutes: 60,
      includeApp: true,
    }),
  });
  return { response, body: await response.json() };
}

describe("demo server", () => {
  it("renders the page without putting a token in the HTML", async () => {
    const hostile = createApp({
      demo: true,
      org: `<img src=x onerror=alert(1)>`,
      version: "0.1.0",
      concurrency: 2,
      gateway: createDemoGateway(),
    });
    const response = await hostile.request("/");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Demo mode");
    expect(html).toContain("Dry run");
    expect(html).toContain("Last 1 hour");
    expect(html).toContain("data-theme");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("github_pat_");
    expect(html).not.toContain("ghp_");
    const font = await hostile.request("/fonts/inter-400.woff2");
    expect(font.status).toBe(200);
    expect(font.headers.get("content-type")).toContain("font/woff2");
    const escaped = await hostile.request("/fonts/..%2Fpackage.json");
    expect(escaped.status).toBe(404);
  });

  it("lists the sample incident's failed deliveries and stuck runs", async () => {
    const { response, body } = await scan();
    expect(response.status).toBe(200);
    expect(body.counts).toMatchObject({
      repositories: 5,
      hooks: 5,
      deliveriesSeen: 11,
      failedDeliveries: 9,
      stuckRuns: 5,
    });
    expect(body.deliveries.some((delivery: { statusCode: number }) => delivery.statusCode === 503)).toBe(true);
    expect(body.deliveries.some((delivery: { reason: string }) => delivery.reason === "missing_response")).toBe(true);
    expect(body.deliveries.some((delivery: { scope: string }) => delivery.scope === "org")).toBe(true);
    expect(body.deliveries.some((delivery: { scope: string }) => delivery.scope === "app")).toBe(true);
    const names = body.runs.map((run: { name: string }) => run.name);
    expect(names).toContain("E2E");
    expect(names).not.toContain("Lint");
    expect(body.markdown).toContain("Failed or missing deliveries: 9");
    expect(body.deliveries.some((delivery: { id: number }) => delivery.id === 801)).toBe(false);
    expect(body.deliveries.some((delivery: { id: number }) => delivery.id === 510)).toBe(false);
    const from = Date.parse("2026-11-09T09:23:00.000Z");
    const to = Date.parse("2026-11-09T11:40:00.000Z");
    for (const delivery of body.deliveries as { deliveredAt: string }[]) {
      const time = Date.parse(delivery.deliveredAt);
      expect(time).toBeGreaterThanOrEqual(from);
      expect(time).toBeLessThanOrEqual(to);
    }
    for (const run of body.runs as { createdAt: string; runStartedAt: string | null }[]) {
      const time = Date.parse(run.runStartedAt || run.createdAt);
      expect(time).toBeGreaterThanOrEqual(from);
      expect(time).toBeLessThanOrEqual(to);
    }
    expect(body.deliveries.some((delivery: { deliveredAt: string }) => delivery.deliveredAt.startsWith("2026-11-09T10:53"))).toBe(true);
  });

  it("keeps the November 9 Actions window separate from the webhook window", async () => {
    const application = app();
    const response = await application.request("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        org: "northwind",
        from: "2026-11-09T18:07",
        to: "2026-11-09T18:59",
        includeApp: true,
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.counts).toMatchObject({ failedDeliveries: 2, stuckRuns: 2 });
    expect(body.runs.map((run: { id: number }) => run.id).sort()).toEqual([1009, 1010]);
    expect(body.deliveries.map((delivery: { id: number }) => delivery.id).sort()).toEqual([510, 511]);
    const from = Date.parse("2026-11-09T18:07:00.000Z");
    const to = Date.parse("2026-11-09T18:59:00.000Z");
    for (const delivery of body.deliveries as { deliveredAt: string }[]) {
      const time = Date.parse(delivery.deliveredAt);
      expect(time).toBeGreaterThanOrEqual(from);
      expect(time).toBeLessThanOrEqual(to);
    }
    for (const run of body.runs as { createdAt: string; runStartedAt: string | null }[]) {
      const time = Date.parse(run.runStartedAt || run.createdAt);
      expect(time).toBeGreaterThanOrEqual(from);
      expect(time).toBeLessThanOrEqual(to);
    }
  });

  it("does not redeliver a delivery outside the scanned window", async () => {
    const application = app();
    await scan(application);
    const refused = await application.request("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dryRun: true,
        operations: [
          { type: "redeliver", scope: "repo", owner: "northwind", repo: "checkout-api", hookId: 11, deliveryId: 510 },
        ],
      }),
    });
    const body = await refused.json();
    expect(refused.status).toBe(400);
    expect(body.error).toMatch(/outside the scanned window/);
  });

  it("includes the dated ping only when the window covers it", async () => {
    const application = app();
    const response = await application.request("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        org: "northwind",
        from: "2026-11-08T18:00",
        to: "2026-11-08T19:00",
        queuedMinutes: 10,
        inProgressMinutes: 60,
        includeApp: true,
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.deliveries.map((delivery: { id: number }) => delivery.id)).toEqual([801]);
  });

  it("dry-run records the request and leaves the delivery failed", async () => {
    const application = app();
    const scanned = await scan(application);
    const delivery = scanned.body.deliveries.find((item: { id: number }) => item.id === 501);
    const planned = await application.request("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dryRun: true,
        operations: [
          {
            type: "redeliver",
            scope: "repo",
            owner: "northwind",
            repo: "checkout-api",
            hookId: delivery.hookId,
            deliveryId: 501,
          },
        ],
      }),
    });
    const plan = await planned.json();
    expect(plan.actions[0]).toMatchObject({ dryRun: true, executed: false, ok: true });
    expect(plan.actions[0].request.path).toBe(
      "/repos/northwind/checkout-api/hooks/11/deliveries/501/attempts",
    );
    const again = await scan(application);
    expect(again.body.deliveries.some((item: { id: number }) => item.id === 501)).toBe(true);
  });

  it("redelivers, force-cancels, and downloads a report when dry-run is off", async () => {
    const application = app();
    await scan(application);
    const executed = await application.request("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dryRun: false,
        operations: [
          { type: "redeliver", scope: "repo", owner: "northwind", repo: "checkout-api", hookId: 11, deliveryId: 501 },
          { type: "force-cancel", owner: "northwind", repo: "web", runId: 1004 },
          { type: "cancel", owner: "northwind", repo: "billing", runId: 1002 },
        ],
      }),
    });
    const body = await executed.json();
    expect(body.summary).toMatchObject({ executed: 3, succeeded: 3, failed: 0 });
    const again = await scan(application);
    expect(again.body.deliveries.some((item: { id: number }) => item.id === 501)).toBe(false);
    expect(again.body.runs.some((item: { id: number }) => item.id === 1004 || item.id === 1002)).toBe(false);

    const json = await application.request("/api/report.json");
    const report = JSON.parse(await json.text()) as { mode: string; actions: unknown[] };
    expect(json.headers.get("content-disposition")).toContain("gh-aftermath-report.json");
    expect(report.mode).toBe("execute");
    expect(report.actions).toHaveLength(3);

    const markdown = await application.request("/api/report.md");
    const text = await markdown.text();
    expect(text).toContain("force-cancel");
    expect(text).toContain("POST /repos/northwind/web/actions/runs/1004/force-cancel");
  });

  it("replaces a stale window error with the error from the next submit", async () => {
    const application = app();
    const inverted = await application.request("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        org: "northwind",
        from: "2026-11-09T18:30",
        to: "2026-11-09T14:00",
      }),
    });
    const invertedBody = await inverted.json();
    expect(inverted.status).toBe(400);
    expect(invertedBody.error).toMatch(/before/);

    const emptyOrg = await application.request("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        org: "   ",
        from: "2026-11-09T14:00",
        to: "2026-11-09T18:30",
      }),
    });
    const emptyBody = await emptyOrg.json();
    expect(emptyOrg.status).toBe(400);
    expect(emptyBody.error).toMatch(/organization/i);
    expect(emptyBody.error).not.toMatch(/before/);
  });

  it("counts a dry-run as this batch and will not keep conflicting plans for one run", async () => {
    const application = app();
    const first = await application.request("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dryRun: true,
        operations: [
          { type: "cancel", owner: "northwind", repo: "web", runId: 1004 },
          { type: "rerun", owner: "northwind", repo: "billing", runId: 1002 },
        ],
      }),
    });
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.summary.planned).toBe(2);

    const conflict = await application.request("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dryRun: true,
        operations: [
          { type: "cancel", owner: "northwind", repo: "checkout-api", runId: 1001 },
          { type: "force-cancel", owner: "northwind", repo: "checkout-api", runId: 1001 },
          { type: "rerun", owner: "northwind", repo: "checkout-api", runId: 1001 },
        ],
      }),
    });
    const conflictBody = await conflict.json();
    expect(conflict.status).toBe(400);
    expect(conflictBody.error).toMatch(/checkout-api #1001/);
    expect(conflictBody.error).toMatch(/cancel, force-cancel, and re-run/);

    const second = await application.request("/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dryRun: true,
        operations: [{ type: "force-cancel", owner: "northwind", repo: "web", runId: 1004 }],
      }),
    });
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.summary.planned).toBe(1);
    expect(secondBody.conflicts[0]).toMatch(/web #1004/);
    expect(secondBody.conflicts[0]).toMatch(/cancel/);
    expect(secondBody.conflicts[0]).toMatch(/force-cancel/);

    const report = JSON.parse(await (await application.request("/api/report.json")).text()) as {
      counts: { planned: number };
      actions: { type: string }[];
      warnings: string[];
    };
    expect(report.counts.planned).toBe(1);
    expect(report.actions.map((action) => action.type)).toEqual(["force-cancel"]);
    expect(report.warnings.some((warning) => warning.includes("web #1004"))).toBe(true);
  });

  it("returns a credential failure instead of an empty scan", async () => {
    const demo = createDemoGateway({ org: "northwind" });
    const gateway: ScanClient & RecoveryClient = {
      ...demo,
      verifyAccess: async () => {
        throw credentialError();
      },
    };
    const application = createApp({
      demo: false,
      org: "northwind",
      version: "0.1.0",
      concurrency: 2,
      gateway,
      clock,
    });
    const response = await application.request("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        org: "northwind",
        from: "2026-11-09T14:00",
        to: "2026-11-09T18:30",
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toMatch(/Bad credentials/);
    expect(body.counts).toBeUndefined();
    expect(body.deliveries).toBeUndefined();
  });

  it("returns a permission failure when organization webhooks are not readable", async () => {
    const demo = createDemoGateway({ org: "northwind" });
    const gateway: ScanClient & RecoveryClient = {
      ...demo,
      listOrgHooks: async () => {
        const error = new Error("Not Found") as Error & { status: number };
        error.status = 404;
        throw error;
      },
    };
    const application = createApp({
      demo: false,
      org: "northwind",
      version: "0.1.0",
      concurrency: 2,
      gateway,
      clock,
    });
    const response = await application.request("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        org: "northwind",
        from: "2026-11-09T14:00",
        to: "2026-11-09T18:30",
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/admin:org_hook/);
    expect(body.error).toMatch(/organization_hooks:write/);
    expect(body.counts).toBeUndefined();
  });
});
