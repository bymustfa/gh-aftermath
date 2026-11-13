#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { hasLiveCredentials, helpText, parseConfig } from "./config.js";
import { redactSecrets } from "./core/redact.js";
import { createDemoGateway } from "./demo/gateway.js";
import { createGitHubGateway } from "./github/gateway.js";
import type { Logger } from "./github/client.js";
import { createApp } from "./server.js";
import { packageVersion } from "./version.js";
import type { RecoveryClient, ScanClient } from "./core/types.js";

const config = (() => {
  try {
    return parseConfig(process.env, process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();

if (config.help) {
  console.log(helpText());
  process.exit(0);
}

const secrets: string[] = [];
if (config.token) secrets.push(config.token);
if (config.privateKey) secrets.push(config.privateKey);

function scrub(message: string): string {
  return redactSecrets(message, secrets);
}

const log: Logger = {
  info: (message) => console.info(scrub(message)),
  warn: (message) => console.warn(scrub(message)),
};

function githubAuth(token?: string) {
  const resolved = token ?? config.token;
  return {
    ...(resolved ? { token: resolved } : {}),
    ...(config.appId ? { appId: config.appId } : {}),
    ...(config.privateKey ? { privateKey: config.privateKey } : {}),
    ...(config.installationId ? { installationId: config.installationId } : {}),
  };
}

function openLiveGateway(token?: string): ScanClient & RecoveryClient {
  return createGitHubGateway(githubAuth(token), {
    log,
    concurrency: config.concurrency,
    maxPages: config.maxPages,
  });
}

let gateway: (ScanClient & RecoveryClient) | null = null;
if (config.demo) {
  gateway = createDemoGateway({ org: config.org });
} else if (hasLiveCredentials(config)) {
  try {
    gateway = openLiveGateway();
  } catch (error) {
    console.error(scrub(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

const version = packageVersion();
const app = createApp({
  demo: config.demo,
  org: config.org,
  version,
  concurrency: config.concurrency,
  gateway,
  includeAppDefault: config.demo || Boolean(config.appId && config.privateKey),
  redact: scrub,
  ...(config.demo
    ? {}
    : {
        acceptToken: async (token: string) => {
          secrets.push(token);
          return openLiveGateway(token);
        },
      }),
});

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  const where = info.address === "0.0.0.0" || info.address === "::" ? "localhost" : info.address;
  const note = config.demo ? " (demo)" : gateway ? "" : " (no token yet — add one in the page)";
  console.log(`gh-aftermath ${version} listening on http://${where}:${info.port}${note}`);
});
