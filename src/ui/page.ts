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
    ? `<p class="banner" id="banner">Demo mode uses sample data from a November 9 Actions and webhooks incident. No GitHub token is used.</p>`
    : "";
  const from = boot.demo ? DEMO_INCIDENT.fromLocal : "";
  const to = boot.demo ? DEMO_INCIDENT.toLocal : "";
  const incidentPressed = boot.demo ? ` aria-pressed="true"` : ` aria-pressed="false"`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>gh-aftermath</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%235b3df5'/%3E%3C/svg%3E" />
<script>
try {
  var saved = localStorage.getItem("gh-aftermath-theme");
  var theme = saved === "light" || saved === "dark" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
} catch (error) {}
</script>
<style>${styles}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the window</a>
<div class="nav-wrap">
  <nav class="nav" aria-label="Primary">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-name">gh-aftermath</span>
    </a>
    <div class="nav-actions">
      <span class="meta" id="rate-limit"></span>
      <button class="btn btn-ghost" id="theme-toggle" type="button" aria-pressed="false">Dark</button>
      <span class="stamp" id="stamp">Dry run</span>
    </div>
  </nav>
</div>
<main id="main" class="page">
  ${banner}
  <header class="page-head">
    <p class="section-kicker">After the incident</p>
    <h1>Clean up the outage window</h1>
    <p class="lede">Pick how far back to look, then replay the webhooks that failed and clear the Actions runs that are still stuck.</p>
  </header>

  <form class="card" id="controls">
    <div class="card-head">
      <div>
        <h2>Window</h2>
        <p class="hint">Presets are in UTC and end at the current minute. The custom range uses the same clock.</p>
      </div>
    </div>
    <div class="presets" role="group" aria-label="Window presets">
      <button class="preset" id="preset-1h" type="button" aria-pressed="false">Last 1 hour</button>
      <button class="preset" id="preset-6h" type="button" aria-pressed="false">Last 6 hours</button>
      <button class="preset" id="preset-24h" type="button" aria-pressed="false">Last 24 hours</button>
      <button class="preset" id="preset-incident" type="button"${incidentPressed}>Nov 9 incident</button>
    </div>
    <div class="grid-form">
      <label class="field">Organization
        <input id="org" name="org" type="text" autocomplete="organization" required value="${org}" />
      </label>
      <label class="field">Window start (UTC)
        <input id="from" name="from" type="datetime-local" required step="60" value="${from}" />
      </label>
      <label class="field">Window end (UTC)
        <input id="to" name="to" type="datetime-local" required step="60" value="${to}" />
      </label>
    </div>
    <div class="switch-row">
      <label class="switch">
        <input id="dry-run" type="checkbox" checked />
        <span>
          <strong>Dry run</strong>
          <span class="hint" id="dry-hint">Requests are listed in the report and are not sent.</span>
        </span>
      </label>
      <label class="switch">
        <input id="include-app" type="checkbox" ${boot.includeApp ? "checked" : ""} />
        <span>Include GitHub App deliveries</span>
      </label>
    </div>
    <details class="advanced">
      <summary>Thresholds</summary>
      <div class="advanced-grid">
        <label class="field">Queued after (minutes)
          <input id="queued-minutes" name="queuedMinutes" type="number" min="1" max="10080" value="${boot.queuedMinutes}" />
        </label>
        <label class="field">In progress after (minutes)
          <input id="progress-minutes" name="inProgressMinutes" type="number" min="1" max="10080" value="${boot.inProgressMinutes}" />
        </label>
      </div>
    </details>
    <div class="form-actions">
      <button class="btn btn-primary" id="scan-button" type="submit">Scan organization</button>
    </div>
    <p id="status" class="status" role="status"></p>
    <ul class="warnings" id="warnings"></ul>
  </form>

  <section class="card" aria-labelledby="timeline-title">
    <div class="card-head">
      <h2 id="timeline-title">Across the window</h2>
      <div class="legend">
        <span><i class="swatch delivery"></i>Failed delivery</span>
        <span><i class="swatch run"></i>Stuck run</span>
      </div>
    </div>
    <svg id="timeline" role="img" aria-label="Deliveries and stuck runs across the selected window"></svg>
    <div class="times"><span id="window-start"></span><span id="window-end"></span></div>
  </section>

  <div class="boards">
    <section class="card" aria-labelledby="deliveries-title">
      <div class="board-head">
        <h2 id="deliveries-title">Webhook deliveries <span class="count" id="delivery-count"></span></h2>
        <button class="btn btn-primary btn-sm" id="redeliver" type="button" disabled>Redeliver</button>
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
            <tr><td class="empty" colspan="5"><strong>No scan yet</strong>Choose a window and scan to list deliveries that failed.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="card" aria-labelledby="runs-title">
      <div class="board-head">
        <h2 id="runs-title">Stuck runs <span class="count" id="run-count"></span></h2>
        <div class="actions">
          <button class="btn btn-outline btn-sm" id="cancel" type="button" disabled>Cancel</button>
          <button class="btn btn-danger btn-sm" id="force-cancel" type="button" disabled title="Stops the run even when the runner does not respond.">Force-cancel</button>
          <button class="btn btn-outline btn-sm" id="rerun" type="button" disabled>Re-run</button>
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
            <tr><td class="empty" colspan="6"><strong>No scan yet</strong>Queued runs, and in-progress runs that have gone on too long, show up here.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <section class="card" aria-labelledby="report-title">
    <div class="report-head">
      <div>
        <h2 id="report-title">Report</h2>
        <p class="hint">Dry-run plans and live calls are both written here.</p>
      </div>
      <div class="actions">
        <a class="btn btn-outline btn-sm" id="download-md" href="/api/report.md">Download Markdown</a>
        <a class="btn btn-outline btn-sm" id="download-json" href="/api/report.json">Download JSON</a>
        <button class="btn btn-ghost btn-sm" id="clear-report" type="button">Clear actions</button>
      </div>
    </div>
    <pre id="report">Scan a window to build the report.</pre>
  </section>
</main>
<p class="note">gh-aftermath ${escapeHtml(boot.version)}. Tokens stay on the server. Space toggles a checkbox. Esc closes a confirmation.</p>
<dialog id="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-detail">
  <form method="dialog" class="dialog-card">
    <h2 id="confirm-title">Send this to GitHub?</h2>
    <p id="confirm-detail"></p>
    <div class="dialog-actions">
      <button class="btn btn-outline" id="confirm-cancel" value="cancel" type="submit">Go back</button>
      <button class="btn btn-primary" id="confirm-accept" value="ok" type="submit">Send to GitHub</button>
    </div>
  </form>
</dialog>
<div id="toast" class="toast" role="status" hidden></div>
<script id="boot" type="application/json">${payload}</script>
<script>${clientSource}</script>
</body>
</html>`;
}
