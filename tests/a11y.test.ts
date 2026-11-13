import { serve, type ServerType } from "@hono/node-server";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDemoGateway } from "../src/demo/gateway.js";
import { createApp } from "../src/server.js";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

let server: ServerType | undefined;
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let base = "";

function serious(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
}

function describeViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>): string {
  return serious(results)
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => {
          const check = node.any[0];
          const ratio = check?.data && typeof check.data === "object" && "contrastRatio" in check.data ? check.data.contrastRatio : "";
          return `  ${node.target.join(" ")} ${ratio} ${check?.message ?? node.failureSummary ?? ""}`;
        })
        .join("\n");
      return `${violation.id} (${violation.impact})\n${nodes}`;
    })
    .join("\n");
}

async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG).analyze();
}

async function openPage(): Promise<Page> {
  if (!context) throw new Error("Browser is not open");
  const page = await context.newPage();
  await page.goto(base);
  return page;
}

async function scanIncident(page: Page) {
  await page.locator("#scan-button").click();
  await page.waitForFunction(() => document.querySelector("#scan-button")?.textContent === "Scan organization");
  expect(await page.locator("#deliveries-body .badge").count()).toBeGreaterThan(0);
  expect(await page.locator("#runs-body .badge.run").count()).toBeGreaterThan(0);
  expect(await page.locator("#runs-body a").count()).toBeGreaterThan(0);
  await page.locator("#runs-body input[type=checkbox]").first().check();
}

async function showLive(page: Page) {
  await page.locator("#dry-run").uncheck();
  await page.locator("#confirm-accept").click();
  await page.waitForFunction(() => document.querySelector("#stamp")?.textContent === "Live");
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate(async (next) => {
    document.documentElement.setAttribute("data-theme", next);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));
  }, theme);
}

beforeAll(async () => {
  const app = createApp({
    demo: true,
    org: "northwind",
    version: "0.1.0",
    concurrency: 4,
    gateway: createDemoGateway({ org: "northwind" }),
    clock: () => new Date("2026-11-13T12:00:00.000Z"),
    includeAppDefault: true,
  });
  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => {
    if (server?.listening) resolve();
    else server?.once("listening", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}/`;
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
}, 30_000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  if (!server) return;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe("accessibility", () => {
  it("reaches Dry run and Scan before the datetime fields, and the report takes keyboard focus", async () => {
    const page = await openPage();
    try {
      await page.locator("a.skip").focus();
      const ids: string[] = [];
      for (let step = 0; step < 40; step += 1) {
        ids.push(await page.evaluate(() => document.activeElement?.id ?? ""));
        await page.keyboard.press("Tab");
      }
      const dry = ids.indexOf("dry-run");
      const scan = ids.indexOf("scan-button");
      const from = ids.indexOf("from");
      const to = ids.indexOf("to");
      expect(dry).toBeGreaterThanOrEqual(0);
      expect(scan).toBeGreaterThan(dry);
      expect(from).toBeGreaterThan(scan);
      expect(to).toBeGreaterThan(from);

      const [fromBox, dryBox, scanBox] = await Promise.all([
        page.locator("#from").boundingBox(),
        page.locator("#dry-run").boundingBox(),
        page.locator("#scan-button").boundingBox(),
      ]);
      expect(fromBox).not.toBeNull();
      expect(dryBox).not.toBeNull();
      expect(scanBox).not.toBeNull();
      expect(fromBox!.y).toBeLessThan(dryBox!.y);
      expect(dryBox!.y).toBeLessThan(scanBox!.y);

      const report = page.locator("#report");
      expect(await report.getAttribute("tabindex")).toBe("0");
      expect(await report.getAttribute("role")).toBe("region");
      expect(await report.getAttribute("aria-label")).toBe("Recovery report");
      const ring = await report.evaluate((element) => {
        if (!(element instanceof HTMLElement)) return { style: "none", width: 0 };
        element.focus({ focusVisible: true });
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
      });
      expect(ring.style).not.toBe("none");
      expect(ring.width).toBeGreaterThanOrEqual(3);
    } finally {
      await page.close();
    }
  });

  it("has no serious or critical WCAG 2.1 AA violations in light or dark", async () => {
    const page = await openPage();
    try {
      await scanIncident(page);
      const light = await analyze(page);
      expect(describeViolations(light)).toBe("");

      await showLive(page);
      const lightLive = await analyze(page);
      expect(describeViolations(lightLive)).toBe("");

      await setTheme(page, "dark");
      const darkLive = await analyze(page);
      expect(describeViolations(darkLive)).toBe("");

      await page.locator("#dry-run").check();
      await page.waitForFunction(() => document.querySelector("#stamp")?.textContent === "Dry run");
      const darkDry = await analyze(page);
      expect(describeViolations(darkDry)).toBe("");
    } finally {
      await page.close();
    }
  }, 60_000);
});
