import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { executeOperations, parseOperations } from "./core/execute.js";
import { buildReport, reportToJson, reportToMarkdown } from "./core/report.js";
import { scanOrganization } from "./core/scan.js";
import { parseWindow } from "./core/time.js";
import type { ActionRecord, RecoveryClient, ScanClient, ScanResult } from "./core/types.js";
import { assertGitHubName } from "./core/paths.js";
import { renderPage, type PageBoot } from "./ui/page.js";

export interface ServerOptions {
  demo: boolean;
  org: string;
  version: string;
  concurrency: number;
  gateway: ScanClient & RecoveryClient;
  queuedMinutesDefault?: number;
  inProgressMinutesDefault?: number;
  includeAppDefault?: boolean;
  clock?: () => Date;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function minutes(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_080) {
    throw new Error("Thresholds must be whole minutes from 1 to 10080.");
  }
  return parsed;
}

function flag(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error("Expected true or false.");
  return value;
}

export function createApp(options: ServerOptions): Hono {
  const app = new Hono();
  const queuedDefault = options.queuedMinutesDefault ?? 10;
  const progressDefault = options.inProgressMinutesDefault ?? 60;
  const includeAppDefault = options.includeAppDefault ?? options.demo;
  let scan: ScanResult | null = null;
  let actions: ActionRecord[] = [];

  function currentReport(generatedAt?: Date) {
    return buildReport({
      version: options.version,
      demo: options.demo,
      org: scan?.org || options.org,
      scan,
      actions,
      ...(generatedAt ? { generatedAt } : {}),
    });
  }

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
    if (!c.req.path.startsWith("/fonts/")) {
      c.header("Cache-Control", "no-store");
    }
  });

  app.get("/fonts/:name", (c) => {
    const name = c.req.param("name");
    if (!/^[a-z0-9-]+\.woff2$/.test(name)) return c.notFound();
    const path = fileURLToPath(new URL(`../assets/fonts/${name}`, import.meta.url));
    if (!existsSync(path)) return c.notFound();
    return c.body(readFileSync(path), 200, {
      "Content-Type": "font/woff2",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });

  app.get("/health", (c) => c.json({ ok: true, version: options.version, demo: options.demo }));

  app.get("/", (c) => {
    const boot: PageBoot = {
      demo: options.demo,
      org: options.org,
      version: options.version,
      queuedMinutes: queuedDefault,
      inProgressMinutes: progressDefault,
      includeApp: includeAppDefault,
    };
    return c.html(renderPage(boot));
  });

  app.get("/api/meta", async (c) => {
    const rateLimit = await options.gateway.rateLimit().catch(() => null);
    return c.json({
      demo: options.demo,
      org: options.org,
      version: options.version,
      dryRunDefault: true,
      rateLimit,
    });
  });

  app.post("/api/scan", async (c) => {
    try {
      const body = asRecord(await c.req.json());
      if (!body) throw new Error("Expected a JSON object.");
      const orgValue = body.org;
      if (typeof orgValue !== "string" || !orgValue.trim()) {
        throw new Error("Enter the GitHub organization to scan.");
      }
      const org = assertGitHubName(orgValue.trim(), "Organization");
      const from = typeof body.from === "string" ? body.from : "";
      const to = typeof body.to === "string" ? body.to : "";
      const window = parseWindow(from, to);
      const queuedMinutes = minutes(body.queuedMinutes, queuedDefault);
      const inProgressMinutes = minutes(body.inProgressMinutes, progressDefault);
      const includeApp = flag(body.includeApp, includeAppDefault);
      scan = await scanOrganization(options.gateway, {
        org,
        window,
        includeApp,
        now: options.clock?.() ?? new Date(),
        queuedThresholdMs: queuedMinutes * 60 * 1000,
        inProgressThresholdMs: inProgressMinutes * 60 * 1000,
        concurrency: options.concurrency,
      });
      const rateLimit = await options.gateway.rateLimit().catch(() => null);
      const report = currentReport(new Date(scan.scannedAt));
      return c.json({ ...scan, demo: options.demo, rateLimit, markdown: reportToMarkdown(report) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scan failed.";
      return c.json({ error: message }, 400);
    }
  });

  app.post("/api/execute", async (c) => {
    try {
      const body = asRecord(await c.req.json());
      if (!body) throw new Error("Expected a JSON object.");
      const dryRun = flag(body.dryRun, true);
      const operations = parseOperations(body.operations);
      if (operations.length === 0) throw new Error("Select at least one delivery or workflow run.");
      const performed = await executeOperations(operations, options.gateway, {
        dryRun,
        concurrency: options.concurrency,
      });
      actions = actions.concat(performed);
      const report = currentReport();
      return c.json({
        dryRun,
        actions: performed,
        summary: {
          planned: report.counts.planned,
          executed: report.counts.executed,
          succeeded: report.counts.succeeded,
          failed: report.counts.failed,
        },
        markdown: reportToMarkdown(report),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not run those actions.";
      return c.json({ error: message }, 400);
    }
  });

  app.post("/api/report/clear", (c) => {
    actions = [];
    const report = currentReport();
    return c.json({ markdown: reportToMarkdown(report) });
  });

  app.get("/api/report.json", (c) => {
    const report = currentReport();
    c.header("Content-Disposition", 'attachment; filename="gh-aftermath-report.json"');
    return c.text(reportToJson(report), 200, { "Content-Type": "application/json; charset=utf-8" });
  });

  app.get("/api/report.md", (c) => {
    const report = currentReport();
    c.header("Content-Disposition", 'attachment; filename="gh-aftermath-report.md"');
    return c.text(reportToMarkdown(report), 200, { "Content-Type": "text/markdown; charset=utf-8" });
  });

  return app;
}
