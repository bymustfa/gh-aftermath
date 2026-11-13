import { readFileSync } from "node:fs";
import { DEMO_ORG } from "./demo/fixtures.js";

export interface AppConfig {
  help: boolean;
  demo: boolean;
  host: string;
  port: number;
  org: string;
  concurrency: number;
  maxPages: number;
  token?: string;
  appId?: string;
  privateKey?: string;
  installationId?: string;
}

const HELP = `gh-aftermath

Self-hosted recovery UI for the mess left after a GitHub incident.

The npm package is not published yet. Run it from a checkout:

  git clone https://github.com/bymustfa/gh-aftermath.git
  cd gh-aftermath
  npm ci
  npm run build
  npm start
  npm start -- --demo

Docker:

  docker build -t gh-aftermath .
  docker run --rm -p 8787:8787 gh-aftermath --demo
  docker run --rm -p 8787:8787 -e GITHUB_TOKEN -e GITHUB_ORG=your-org gh-aftermath

Coming soon, after the package is published:

  npx gh-aftermath --demo

Usage
  gh-aftermath [--demo] [--org ORG] [--host HOST] [--port PORT]

Environment
  GITHUB_TOKEN                 Personal access token for org, repo, and Actions APIs.
                               If unset, the server still starts and the page asks for one.
                               That token stays in server memory only and is not written to disk.
  GITHUB_ORG                   Organization shown in the form
  GITHUB_APP_ID                GitHub App id, for app webhook deliveries
  GITHUB_APP_PRIVATE_KEY       App private key (PEM, or with escaped newlines)
  GITHUB_APP_PRIVATE_KEY_PATH  Alternative path to the PEM file
  GITHUB_APP_INSTALLATION_ID   Installation used to scan an organization
  PORT                         Default 8787
  HOST                         Default 0.0.0.0
  DEMO=1                       Sample data, no token
  CONCURRENCY                  Parallel GitHub calls (default 4)
  MAX_PAGES                    Pages of 100 to read per list (default 20)
`;

export function helpText(): string {
  return HELP;
}

export function hasLiveCredentials(config: Pick<AppConfig, "token" | "appId" | "privateKey" | "installationId">): boolean {
  if (config.token) return true;
  return Boolean(config.appId && config.privateKey && config.installationId);
}

function normalizeKey(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  return trimmed.includes("\\n") ? trimmed.replaceAll("\\n", "\n") : trimmed;
}

function readPrivateKey(env: NodeJS.ProcessEnv): string | undefined {
  if (env.GITHUB_APP_PRIVATE_KEY) return normalizeKey(env.GITHUB_APP_PRIVATE_KEY);
  if (env.GITHUB_APP_PRIVATE_KEY_PATH) {
    return normalizeKey(readFileSync(env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8"));
  }
  return undefined;
}

function integerOption(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

export function parseConfig(env: NodeJS.ProcessEnv, argv: string[]): AppConfig {
  let demo = env.DEMO === "1" || env.DEMO === "true";
  let host = env.HOST || "0.0.0.0";
  let port = integerOption(env.PORT, 8787, "PORT");
  let org = env.GITHUB_ORG || "";
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--demo") {
      demo = true;
      continue;
    }
    if (arg === "--host") {
      const value = argv[index + 1];
      if (!value) throw new Error("--host needs a value.");
      host = value;
      index += 1;
      continue;
    }
    if (arg === "--port") {
      const value = argv[index + 1];
      if (!value) throw new Error("--port needs a value.");
      port = integerOption(value, 8787, "--port");
      index += 1;
      continue;
    }
    if (arg === "--org") {
      const value = argv[index + 1];
      if (!value) throw new Error("--org needs a value.");
      org = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg ?? ""}`);
  }

  if (port > 65535) throw new Error("Port must be between 1 and 65535.");

  return {
    help,
    demo,
    host,
    port,
    org: org || (demo ? DEMO_ORG : ""),
    concurrency: integerOption(env.CONCURRENCY, 4, "CONCURRENCY"),
    maxPages: integerOption(env.MAX_PAGES, 20, "MAX_PAGES"),
    token: env.GITHUB_TOKEN || undefined,
    appId: env.GITHUB_APP_ID || undefined,
    privateKey: readPrivateKey(env),
    installationId: env.GITHUB_APP_INSTALLATION_ID || undefined,
  };
}
