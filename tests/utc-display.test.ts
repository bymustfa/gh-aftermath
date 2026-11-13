import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDemoGateway } from "../src/demo/gateway.js";
import { createApp } from "../src/server.js";
import { clientSource } from "../src/ui/client.js";
import { hoursWindow, toUtcDateTimeLocal } from "../src/core/presets.js";
import { parseUserTime } from "../src/core/time.js";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const root = fileURLToPath(new URL("..", import.meta.url));

describe("UTC window fields", () => {
  it("round-trips the text that is shown and sent", () => {
    const shown = toUtcDateTimeLocal(new Date("2026-11-13T15:04:00.000Z"));
    const sent = shown;
    expect(shown).toBe("2026-11-13T15:04");
    expect(sent).toBe(shown);
    expect(parseUserTime(sent)).toBe("2026-11-13T15:04:00.000Z");
    expect(hoursWindow(new Date("2026-11-13T15:04:00.000Z"), 1)).toEqual({
      from: "2026-11-13T14:04",
      to: "2026-11-13T15:04",
    });
  });

  it("renders plain UTC text inputs instead of datetime-local controls", async () => {
    const application = createApp({
      demo: true,
      org: "northwind",
      version: "0.1.0",
      concurrency: 2,
      gateway: createDemoGateway(),
    });
    const html = await (await application.request("/")).text();
    const from = html.match(/<input id="from"[^>]*>/)?.[0] ?? "";
    const to = html.match(/<input id="to"[^>]*>/)?.[0] ?? "";
    expect(html).not.toMatch(/<input[^>]+type="datetime-local"/);
    expect(from).toContain('type="text"');
    expect(to).toContain('type="text"');
    expect(from).not.toContain("datetime-local");
    expect(to).not.toContain("datetime-local");
    expect(from).toContain('value="2026-11-09T09:23"');
    expect(to).toContain('value="2026-11-09T11:40"');
    expect(html).toContain("Nov 9 webhooks");
    expect(html).toContain("Nov 9 Actions");
    expect(html).toContain("2026-11-09T18:07");
    expect(html).toContain("2026-11-09T18:59");
    expect(html).not.toContain("Nov 9 incident");
    expect(html).toContain(">UTC<");
    expect(html).toContain("characters you see are the characters that are sent");
    expect(clientSource).toContain('from: $("from").value');
    expect(clientSource).toContain('to: $("to").value');
    expect(clientSource).toContain("function toUtcDateTimeLocal");
    expect(clientSource).not.toContain("datetime-local");
    expect(clientSource).not.toContain(".getHours(");
    expect(clientSource).not.toContain(".getMinutes(");
    expect(clientSource).not.toContain(".getDate(");
    expect(clientSource).not.toContain(".getFullYear(");
    expect(clientSource).not.toContain(".getMonth(");
  });

  it("keeps the shown UTC digits in America/New_York", () => {
    const script = `
      import vm from "node:vm";
      import { hoursWindow, toUtcDateTimeLocal } from "./src/core/presets.ts";
      import { parseUserTime } from "./src/core/time.ts";
      import { embeddedLogic } from "./src/ui/embed.ts";

      const instant = new Date("2026-11-13T15:04:00.000Z");
      if (instant.getUTCHours() !== 15) {
        console.error("utc hour", instant.getUTCHours());
        process.exit(2);
      }
      if (instant.getHours() === instant.getUTCHours()) {
        console.error("timezone did not change local hours", process.env.TZ, instant.toString());
        process.exit(3);
      }
      const shown = toUtcDateTimeLocal(instant);
      const sent = shown;
      if (shown !== "2026-11-13T15:04") {
        console.error("shown", shown, "local", instant.getHours());
        process.exit(4);
      }
      if (sent !== shown) process.exit(5);
      if (parseUserTime(sent) !== "2026-11-13T15:04:00.000Z") {
        console.error("parsed", parseUserTime(sent));
        process.exit(6);
      }
      const window = hoursWindow(instant, 1);
      if (window.from !== "2026-11-13T14:04" || window.to !== sent) {
        console.error("preset", JSON.stringify(window));
        process.exit(7);
      }
      const sandbox = { result: "", stamps: null };
      vm.createContext(sandbox);
      vm.runInContext(embeddedLogic + "\\nresult = toUtcDateTimeLocal(new Date('2026-11-13T15:04:00.000Z'));", sandbox);
      if (sandbox.result !== shown) {
        console.error("embedded", sandbox.result);
        process.exit(8);
      }
      const stamps = {};
      vm.runInContext(
        embeddedLogic + "\\nstamps = { inside: formatUtcStamp('2026-11-09T10:53:44.000Z'), outside: formatUtcStamp('2026-11-09T18:53:00.000Z') };",
        sandbox,
      );
      console.log(JSON.stringify({ shown, sent, localHour: instant.getHours(), stamps: sandbox.stamps }));
    `;
    const result = spawnSync(process.execPath, [tsxCli, "--eval", script], {
      cwd: root,
      env: { ...process.env, TZ: "America/New_York" },
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      shown: string;
      sent: string;
      localHour: number;
      stamps: { inside: string; outside: string };
    };
    expect(parsed.localHour).not.toBe(15);
    expect(parsed.shown).toBe("2026-11-13T15:04");
    expect(parsed.stamps).toEqual({ inside: "09 Nov 10:53Z", outside: "09 Nov 18:53Z" });
    expect(parsed.sent).toBe(parsed.shown);
  });
});
