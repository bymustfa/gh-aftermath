import { readFileSync } from "node:fs";

let cached: string | undefined;

export function packageVersion(): string {
  if (cached) return cached;
  const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  cached = parsed.version ?? "0.0.0";
  return cached;
}
