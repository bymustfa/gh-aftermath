import { DEMO_INCIDENT } from "../demo/fixtures.js";
import { clientSource } from "./client.js";
import { escapeHtml, safeJson } from "./html.js";
import { styles } from "./styles.js";

export interface PageBoot {
  demo: boolean;
  org: string;
  version: string;
  queuedMinutes: number;
  inProgressMinutes: number;
  includeApp: boolean;
}

export function renderPage(boot: PageBoot): string {
  const org = escapeHtml(boot.org);
  const payload = safeJson({
    demo: boot.demo,
    incidentFrom: DEMO_INCIDENT.fromLocal,
    incidentTo: DEMO_INCIDENT.toLocal,
    version: boot.version,
  });
  const banner = boot.demo
    ? `<div class="banner" id="banner">Demo mode uses sample data from a November 9 Actions and webhooks incident. No GitHub token is used.</div>`
    : "";
  const from = boot.demo ? DEMO_INCIDENT.fromLocal : "";
  const to = boot.demo ? DEMO_INCIDENT.toLocal : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>gh-aftermath</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23c24e24'/%3E%3C/svg%3E" />
<style>${styles}</style>
</head>
<body>
<header class="top">
  <div class="wrap top-inner">
    <div class="brand">
      <span class="mark" aria-hidden="true"></span>
      <div>
        <h1>gh-aftermath</h1>
        <p class="lede">Pick the outage window. Replay the webhooks that failed and clear the Actions runs that are still stuck.</p>
      </div>
    </div>
    <div class="side">
      <div class="stamp" id="stamp">Dry run</div>
      <div class="meta" id="rate-limit"></div>
    </div>
  </div>
</header>
${banner}
<main class="wrap">
  <form class="panel controls" id="controls">
    <label>Organization
      <input id="org" name="org" type="text" autocomplete="organization" required value="${org}" />
    </label>
    <label>Window start (UTC)
      <input id="from" name="from" type="datetime-local" required step="60" value="${from}" />
    </label>
    <label>Window end (UTC)
      <input id="to" name="to" type="datetime-local" required step="60" value="${to}" />
    </label>
    <div class="actions">
      <button class="primary" id="scan-button" type="submit">Scan organization</button>
    </div>
    <label>Queued after (minutes)
      <input id="queued-minutes" name="queuedMinutes" type="number" min="1" max="10080" value="${boot.queuedMinutes}" />
    </label>
    <label>In progress after (minutes)
      <input id="progress-minutes" name="inProgressMinutes" type="number" min="1" max="10080" value="${boot.inProgressMinutes}" />
    </label>
    <div class="checks">
      <label><input id="include-app" type="checkbox" ${boot.includeApp ? "checked" : ""} /> App deliveries</label>
      <label><input id="dry-run" type="checkbox" checked /> Dry run</label>
    </div>
    <div class="presets">
      <button class="quiet" id="preset-incident" type="button">Nov 9 incident</button>
      <button class="quiet" id="preset-6h" type="button">Last 6 hours</button>
      <button class="quiet" id="preset-24h" type="button">Last 24 hours</button>
    </div>
    <p class="help">Times are UTC. Dry run lists the exact requests and writes them to the report. Turn it off to redeliver, cancel, force-cancel, or re-run.</p>
    <p id="status" role="status"></p>
    <ul class="warnings" id="warnings"></ul>
  </form>

  <section class="panel" aria-labelledby="timeline-title">
    <div class="timeline-head">
      <h2 id="timeline-title">Window</h2>
      <div class="legend">
        <span><i class="swatch delivery"></i>Failed delivery</span>
        <span><i class="swatch run"></i>Stuck run</span>
      </div>
    </div>
    <svg id="timeline" role="img" aria-label="Deliveries and stuck runs across the selected window"></svg>
    <div class="times"><span id="window-start"></span><span id="window-end"></span></div>
  </section>

  <div class="boards">
    <section class="panel" aria-labelledby="deliveries-title">
      <div class="board-head">
        <h2 id="deliveries-title">Webhook deliveries <span id="delivery-count"></span></h2>
        <div class="actions">
          <button class="primary" id="redeliver" type="button" disabled>Redeliver</button>
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th><input id="select-deliveries" type="checkbox" aria-label="Select all deliveries" /></th>
              <th>When</th>
              <th>Where</th>
              <th>Event</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody id="deliveries-body">
            <tr><td class="empty" colspan="5">Scan an organization to list deliveries that failed in this window.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel" aria-labelledby="runs-title">
      <div class="board-head">
        <h2 id="runs-title">Stuck workflow runs <span id="run-count"></span></h2>
        <div class="actions">
          <button class="secondary" id="cancel" type="button" disabled>Cancel</button>
          <button class="secondary danger" id="force-cancel" type="button" disabled title="POST force-cancel. Use this when a normal cancel does not stick.">Force-cancel</button>
          <button class="secondary" id="rerun" type="button" disabled>Re-run</button>
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th><input id="select-runs" type="checkbox" aria-label="Select all stuck runs" /></th>
              <th>When</th>
              <th>Repository</th>
              <th>Workflow</th>
              <th>Status</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody id="runs-body">
            <tr><td class="empty" colspan="6">Queued runs, and in-progress runs that have been running too long, show up here.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <section class="panel" aria-labelledby="report-title">
    <div class="report-head">
      <h2 id="report-title">Report</h2>
      <div class="actions">
        <a class="button" id="download-md" href="/api/report.md">Download Markdown</a>
        <a class="button" id="download-json" href="/api/report.json">Download JSON</a>
        <button class="quiet" id="clear-report" type="button">Clear actions</button>
      </div>
    </div>
    <pre id="report">Scan a window to build the report. Actions you plan or send are appended here.</pre>
  </section>
</main>
<footer>gh-aftermath ${escapeHtml(boot.version)}. Tokens stay in the server environment and are not shown in this page.</footer>
<script id="boot" type="application/json">${payload}</script>
<script>${clientSource}</script>
</body>
</html>`;
}
