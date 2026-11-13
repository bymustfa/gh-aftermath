import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { AccessError } from "./core/access.js";
import { executeOperations, parseOperations } from "./core/execute.js";
import { applyDryRunBatch, assertCompatibleRunPlans, batchSummary } from "./core/plans.js";
import { redactSecrets } from "./core/redact.js";
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
  gateway: (ScanClient & RecoveryClient) | null;
  queuedMinutesDefault?: number;
  inProgressMinutesDefault?: number;
  includeAppDefault?: boolean;
  clock?: () => Date;
  /** Stores a token in memory and returns the gateway it authorizes. Not used in demo mode. */
  acceptToken?: (token: string) => Promise<ScanClient & RecoveryClient>;
  redact?: (message: string) => string;
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

function readSessionToken(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a GitHub token.");
  const token = value.trim();
  if (!token) throw new Error("Enter a GitHub token.");
  if (token.length < 8 || token.length > 512) {
    throw new Error("That token does not look usable. Paste the token GitHub showed you.");
  }
  for (let index = 0; index < token.length; index += 1) {
    const code = token.charCodeAt(index);
    if (code <= 32 || code === 127) {
      throw new Error("A token cannot contain spaces or line breaks.");
    }
  }
  return token;
}

export function createApp(options: ServerOptions): Hono {
  const app = new Hono();
  const queuedDefault = options.queuedMinutesDefault ?? 10;
  const progressDefault = options.inProgressMinutesDefault ?? 60;
  const includeAppDefault = options.includeAppDefault ?? options.demo;
  let scan: ScanResult | null = null;
  let actions: ActionRecord[] = [];
  let planWarnings: string[] = [];
  let gateway = options.gateway;
  let credentialsReady = gateway !== null;
  const heldSecrets: string[] = [];

  function needsToken(): boolean {
    return !options.demo && !credentialsReady;
  }

  function scrub(message: string): string {
    const passed = options.redact ? options.redact(message) : message;
    return redactSecrets(passed, heldSecrets);
  }

  function requireGateway(): ScanClient & RecoveryClient {
    if (!gateway) {
      throw new Error(
        "Enter a GitHub token on this page before scanning. It stays in server memory for this process and is not written to disk.",
      );
    }
    return gateway;
  }

  function currentReport(generatedAt?: Date) {
    const report = buildReport({
      version: options.version,
      demo: options.demo,
      org: scan?.org || options.org,
      scan,
      actions,
      ...(generatedAt ? { generatedAt } : {}),
    });
    if (planWarnings.length > 0) report.warnings = [...report.warnings, ...planWarnings];
    return report;
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
      needsToken: needsToken(),
    };
    return c.html(renderPage(boot));
  });

  app.get("/api/meta", async (c) => {
    const rateLimit = gateway ? await gateway.rateLimit().catch(() => null) : null;
    return c.json({
      demo: options.demo,
      org: options.org,
      version: options.version,
      dryRunDefault: true,
      needsToken: needsToken(),
      rateLimit,
    });
  });

  app.post("/api/token", async (c) => {
    try {
      if (options.demo) throw new Error("Demo mode does not use a GitHub token.");
      if (credentialsReady) throw new Error("A GitHub token is already configured for this process.");
      if (!options.acceptToken) throw new Error("This server cannot store a session token.");
      let parsed: unknown;
      try {
        parsed = await c.req.json();
      } catch {
        throw new Error("Expected a JSON object.");
      }
      const body = asRecord(parsed);
      if (!body) throw new Error("Expected a JSON object.");
      const token = readSessionToken(body.token);
      heldSecrets.push(token);
      try {
        gateway = await options.acceptToken(token);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not use that token.";
        throw new Error(scrub(message));
      }
      credentialsReady = true;
      return c.json({ ok: true, needsToken: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the token.";
      return c.json({ error: scrub(message) }, 400);
    }
  });

  app.post("/api/scan", async (c) => {
    try {
      const active = requireGateway();
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
      scan = await scanOrganization(active, {
        org,
        window,
        includeApp,
        now: options.clock?.() ?? new Date(),
        queuedThresholdMs: queuedMinutes * 60 * 1000,
        inProgressThresholdMs: inProgressMinutes * 60 * 1000,
        concurrency: options.concurrency,
      });
      const rateLimit = await active.rateLimit().catch(() => null);
      const report = currentReport(new Date(scan.scannedAt));
      return c.json({ ...scan, demo: options.demo, rateLimit, markdown: reportToMarkdown(report) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scan failed.";
      const status = error instanceof AccessError && (error.status === 401 || error.status === 403) ? error.status : 400;
      return c.json({ error: scrub(message) }, status);
    }
  });

  app.post("/api/execute", async (c) => {
    try {
      const active = requireGateway();
      const body = asRecord(await c.req.json());
      if (!body) throw new Error("Expected a JSON object.");
      const dryRun = flag(body.dryRun, true);
      const operations = parseOperations(body.operations);
      if (operations.length === 0) throw new Error("Select at least one delivery or workflow run.");
      assertCompatibleRunPlans(operations);
      if (scan) {
        for (const operation of operations) {
          if (operation.type === "redeliver") {
            if (!scan.deliveries.some((delivery) => delivery.id === operation.deliveryId)) {
              throw new Error("That delivery is outside the scanned window, so it was not redelivered.");
            }
          } else if (
            !scan.runs.some(
              (run) => run.id === operation.runId && run.owner === operation.owner && run.repo === operation.repo,
            )
          ) {
            throw new Error("That workflow run is outside the scanned window, so it was not changed.");
          }
        }
      }
      const performed = await executeOperations(operations, active, {
        dryRun,
        concurrency: options.concurrency,
      });
      let conflicts: string[] = [];
      if (dryRun) {
        const merged = applyDryRunBatch(actions, performed);
        actions = merged.actions;
        conflicts = merged.conflicts;
        planWarnings = conflicts;
      } else {
        actions = actions.concat(performed);
      }
      const report = currentReport();
      return c.json({
        dryRun,
        actions: performed,
        summary: batchSummary(performed),
        conflicts,
        markdown: reportToMarkdown(report),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not run those actions.";
      return c.json({ error: scrub(message) }, 400);
    }
  });

  app.post("/api/report/clear", (c) => {
    actions = [];
    planWarnings = [];
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
