import { spawn, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoGateway } from "../src/demo/gateway.js";
import { createApp } from "../src/server.js";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const root = fileURLToPath(new URL("..", import.meta.url));
const children: ChildProcess[] = [];

function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "GITHUB_TOKEN",
    "GH_TOKEN",
    "GITHUB_APP_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_PRIVATE_KEY_PATH",
    "GITHUB_APP_INSTALLATION_ID",
    "DEMO",
  ]) {
    delete env[key];
  }
  return env;
}

async function startCli(args: string[]): Promise<{ child: ChildProcess; port: number; output: () => string }> {
  const port = 26000 + Math.floor(Math.random() * 20000);
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [tsxCli, "src/cli.ts", "--host", "127.0.0.1", "--port", String(port), ...args], {
    cwd: root,
    env: childEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (stdout.includes("listening on")) return { child, port, output: () => stdout + stderr };
    if (child.exitCode !== null) {
      throw new Error(`cli exited ${child.exitCode}\n${stdout}\n${stderr}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill("SIGKILL");
  throw new Error(`cli did not listen\n${stdout}\n${stderr}`);
}

function filesContaining(dir: string, secret: string, hits: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "coverage") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) filesContaining(path, secret, hits);
    else if (entry.isFile() && statSync(path).size < 2_000_000 && readFileSync(path).includes(secret)) hits.push(path);
  }
  return hits;
}

afterEach(() => {
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  children.length = 0;
});

describe("token-less startup", () => {
  it("starts the server without a token and keeps a pasted token in memory only", async () => {
    const secret = `ghp_memory${Date.now().toString(36)}onlyvalue`;
    const rejected = `ghp_reject${Date.now().toString(36)}valueone`;
    let held: string | undefined;
    const application = createApp({
      demo: false,
      org: "",
      version: "0.1.0",
      concurrency: 2,
      gateway: null,
      acceptToken: async (token) => {
        held = token;
        if (token === rejected) throw new Error("GitHub refused " + token);
        return createDemoGateway({ org: "northwind" });
      },
    });

    try {
      const first = await (await application.request("/")).text();
      expect(first).toContain('type="password"');
      expect(first).toContain("admin:org_hook");
      expect(first).toContain("admin:repo_hook");
      expect(first).toContain("not written to disk");
      expect(first).toContain("Fine-grained");
      expect(first).not.toContain(secret);
      const meta = await (await application.request("/api/meta")).json();
      expect(meta.needsToken).toBe(true);

      const blocked = await application.request("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ org: "northwind", from: "2026-11-09T14:00", to: "2026-11-09T18:30" }),
      });
      expect(blocked.status).toBe(400);
      expect((await blocked.json()).error).toMatch(/token/i);

      const refused = await application.request("/api/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: rejected }),
      });
      const refusedBody = await refused.text();
      expect(refused.status).toBe(400);
      expect(refusedBody).not.toContain(rejected);
      expect(refusedBody).toContain("[redacted]");
      expect(refused.headers.get("set-cookie")).toBeNull();

      const saved = await application.request("/api/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: secret }),
      });
      const savedBody = await saved.text();
      expect(saved.status).toBe(200);
      expect(savedBody).not.toContain(secret);
      expect(saved.headers.get("set-cookie")).toBeNull();
      expect(held).toBe(secret);

      const again = await application.request("/api/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: secret }),
      });
      expect(again.status).toBe(400);
      expect(await again.text()).not.toContain(secret);

      const page = await (await application.request("/")).text();
      expect(page).not.toContain(secret);
      expect(page).not.toContain('id="token"');
      const ready = await (await application.request("/api/meta")).json();
      expect(ready.needsToken).toBe(false);

      const scanned = await application.request("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ org: "northwind", from: "2026-11-09T14:00", to: "2026-11-09T18:30" }),
      });
      const scanText = await scanned.text();
      expect(scanned.status).toBe(200);
      expect(scanText).not.toContain(secret);
      expect(filesContaining(root, secret)).toEqual([]);
      expect(filesContaining(root, rejected)).toEqual([]);
    } finally {
      expect(filesContaining(root, secret)).toEqual([]);
    }
  });

  it("does not exit when GITHUB_TOKEN is missing, and demo mode still skips the token field", async () => {
    const live = await startCli([]);
    try {
      expect(live.child.exitCode).toBeNull();
      expect(live.output()).toContain("no token yet");
      const html = await (await fetch(`http://127.0.0.1:${live.port}/`)).text();
      expect(html).toContain('type="password"');
      expect(html).toContain("admin:org_hook");
      const secret = `ghp_process${Date.now().toString(36)}memoryvalue`;
      const posted = await fetch(`http://127.0.0.1:${live.port}/api/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: secret }),
      });
      const body = await posted.text();
      expect(posted.status).toBe(200);
      expect(body).not.toContain(secret);
      expect(posted.headers.get("set-cookie")).toBeNull();
      const again = await (await fetch(`http://127.0.0.1:${live.port}/`)).text();
      expect(again).not.toContain(secret);
      expect(again).not.toContain('id="token"');
      expect(live.output()).not.toContain(secret);
      expect(filesContaining(root, secret)).toEqual([]);
      expect(live.child.exitCode).toBeNull();
    } finally {
      live.child.kill("SIGKILL");
    }

    const demo = await startCli(["--demo"]);
    try {
      const html = await (await fetch(`http://127.0.0.1:${demo.port}/`)).text();
      expect(html).toContain("Demo mode");
      expect(html).not.toContain('id="token"');
      const posted = await fetch(`http://127.0.0.1:${demo.port}/api/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "ghp_demomustignorethisvalue123" }),
      });
      const body = await posted.text();
      expect(posted.status).toBe(400);
      expect(body).not.toContain("ghp_demomustignorethisvalue123");
      expect(demo.child.exitCode).toBeNull();
    } finally {
      demo.child.kill("SIGKILL");
    }
  });
});
