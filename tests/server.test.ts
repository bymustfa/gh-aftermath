import { describe, expect, it } from "vitest";
import { createDemoGateway } from "../src/demo/gateway.js";
import { createApp } from "../src/server.js";

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
      from: "2026-11-09T14:00",
      to: "2026-11-09T18:30",
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
      deliveriesSeen: 12,
      failedDeliveries: 10,
      stuckRuns: 5,
    });
    expect(body.deliveries.some((delivery: { statusCode: number }) => delivery.statusCode === 503)).toBe(true);
    expect(body.deliveries.some((delivery: { reason: string }) => delivery.reason === "missing_response")).toBe(true);
    expect(body.deliveries.some((delivery: { scope: string }) => delivery.scope === "org")).toBe(true);
    expect(body.deliveries.some((delivery: { scope: string }) => delivery.scope === "app")).toBe(true);
    const names = body.runs.map((run: { name: string }) => run.name);
    expect(names).toContain("E2E");
    expect(names).not.toContain("Lint");
    expect(body.markdown).toContain("Failed or missing deliveries: 10");
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
});
