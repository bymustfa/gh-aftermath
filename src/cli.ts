#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { helpText, parseConfig } from "./config.js";
import { createDemoGateway } from "./demo/gateway.js";
import { createGitHubGateway } from "./github/gateway.js";
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

let gateway: ScanClient & RecoveryClient;
try {
  gateway = config.demo
    ? createDemoGateway({ org: config.org })
    : createGitHubGateway(
        {
          token: config.token,
          appId: config.appId,
          privateKey: config.privateKey,
          installationId: config.installationId,
        },
        { concurrency: config.concurrency, maxPages: config.maxPages },
      );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("Run with --demo to open the sample incident, or set GITHUB_TOKEN.");
  process.exit(1);
}

const version = packageVersion();
const app = createApp({
  demo: config.demo,
  org: config.org,
  version,
  concurrency: config.concurrency,
  gateway,
  includeAppDefault: config.demo || Boolean(config.appId && config.privateKey),
});

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  const where = info.address === "0.0.0.0" || info.address === "::" ? "localhost" : info.address;
  console.log(`gh-aftermath ${version} listening on http://${where}:${info.port}${config.demo ? " (demo)" : ""}`);
});
