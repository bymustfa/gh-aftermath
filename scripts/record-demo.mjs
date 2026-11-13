import { spawn } from "node:child_process";
import { mkdir, rename } from "node:fs/promises";
import { chromium } from "playwright";

async function chooseRows(page, selector, indexes) {
  await page.evaluate(
    ({ rowSelector, indexes: wanted }) => {
      document.querySelectorAll(rowSelector).forEach((box, index) => {
        const shouldCheck = wanted.includes(index);
        if (box.checked !== shouldCheck) box.click();
      });
    },
    { rowSelector: selector, indexes },
  );
}

const port = 8791;
const base = `http://127.0.0.1:${port}`;

function waitForServer() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist/cli.js", "--demo", "--port", String(port), "--host", "127.0.0.1"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DEMO: "1" },
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error("demo server did not start"));
    }, 15000);
    const onData = (chunk) => {
      const text = String(chunk);
      if (text.includes("listening")) {
        settled = true;
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      onData(chunk);
    });
    child.on("exit", (code) => {
      if (!settled) reject(new Error(`demo server exited ${code}`));
    });
  });
}

async function pause(page, ms) {
  await page.waitForTimeout(ms);
}

async function showReportActions(page) {
  await page.locator("#report").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const pre = document.querySelector("#report");
    const marker = pre.textContent.indexOf("## Actions");
    if (marker > 0) pre.scrollTop = Math.max(0, pre.scrollHeight * (marker / pre.textContent.length) - 24);
    else pre.scrollTop = pre.scrollHeight;
  });
}

const server = await waitForServer();
await mkdir("tmp/demo-video", { recursive: true });
await mkdir("docs", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  recordVideo: { dir: "tmp/demo-video", size: { width: 1400, height: 900 } },
});
const page = await context.newPage();
page.on("pageerror", (error) => {
  console.error(`page error: ${error.message}`);
});

try {
  await page.goto(base, { waitUntil: "load" });
  await pause(page, 600);
  await page.click("#preset-6h");
  await pause(page, 900);
  await page.click("#preset-webhooks");
  await pause(page, 800);
  await page.click("#scan-button");
  await page.waitForSelector("#deliveries-body tr.selected, #deliveries-body td", { timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll("#deliveries-body tr").length > 3);
  await page.locator("#deliveries-title").scrollIntoViewIfNeeded();
  await pause(page, 900);
  await page.screenshot({ path: "docs/screenshot.png" });
  await chooseRows(page, "#deliveries-body input[type=checkbox]", [0, 1, 2]);
  await pause(page, 400);
  await page.click("#redeliver");
  await page.waitForFunction(() => /Dry run planned/.test(document.querySelector("#status")?.textContent || ""));
  await pause(page, 1000);
  await chooseRows(page, "#runs-body input[type=checkbox]", [0, 1]);
  await pause(page, 400);
  await page.click("#cancel");
  await page.waitForFunction(() => /planned/.test(document.querySelector("#status")?.textContent || ""));
  await pause(page, 800);
  await showReportActions(page);
  await pause(page, 1200);
  await page.screenshot({ path: "docs/screenshot-report.png" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(page, 300);
  await page.click("#dry-run");
  await page.waitForSelector("#confirm[open], dialog[open]");
  await pause(page, 700);
  await page.click("#confirm-accept");
  await pause(page, 500);
  await page.evaluate(() => window.scrollTo(0, 280));
  await pause(page, 300);
  await chooseRows(page, "#deliveries-body input[type=checkbox]", [0, 1]);
  await chooseRows(page, "#runs-body input[type=checkbox]", [0]);
  await pause(page, 400);
  await page.click("#redeliver");
  await page.waitForSelector("dialog[open]");
  await pause(page, 500);
  await page.click("#confirm-accept");
  await page.waitForFunction(() => /Found/.test(document.querySelector("#status")?.textContent || ""));
  await pause(page, 600);
  await chooseRows(page, "#runs-body input[type=checkbox]", [0]);
  await page.click("#force-cancel");
  await page.waitForSelector("dialog[open]");
  await pause(page, 500);
  await page.click("#confirm-accept");
  await page.waitForFunction(() => /Found/.test(document.querySelector("#status")?.textContent || ""));
  await pause(page, 700);
  await showReportActions(page);
  await pause(page, 1400);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  server.kill("SIGTERM");
  if (video) {
    const webmPath = await video.path();
    await rename(webmPath, "tmp/demo-video/demo.webm");
  }
}

await new Promise((resolve, reject) => {
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-i",
      "tmp/demo-video/demo.webm",
      "-vf",
      "fps=8,scale=1040:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
      "docs/demo.gif",
    ],
    { stdio: "inherit" },
  );
  ffmpeg.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
});

console.log("wrote docs/demo.gif docs/screenshot.png docs/screenshot-report.png");
