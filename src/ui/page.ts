import { DEMO_INCIDENT } from "../demo/fixtures.js";
import { clientSource } from "./client.js";
import { escapeHtml, safeJson } from "./html.js";
import { flowStyles } from "./flow-styles.js";
import { styles } from "./styles.js";

export interface PageBoot {
  demo: boolean;
  org: string;
  version: string;
  queuedMinutes: number;
  inProgressMinutes: number;
  includeApp: boolean;
  needsToken: boolean;
}

export function renderPage(boot: PageBoot): string {
  const org = escapeHtml(boot.org);
  const payload = safeJson({
    demo: boot.demo,
    incidentFrom: DEMO_INCIDENT.fromLocal,
    incidentTo: DEMO_INCIDENT.toLocal,
    version: boot.version,
    needsToken: boot.needsToken,
  });
  const tokenCard = boot.needsToken
    ? `<form class="card" id="token-form">
    <div class="card-head">
      <div>
        <h2>GitHub token</h2>
        <p class="hint">No <code>GITHUB_TOKEN</code> is set, so this server started without one. Paste a token to scan. It stays in this server's memory until the process stops. It is not written to disk, not stored in the browser, and not added to the report or the logs.</p>
      </div>
    </div>
    <label class="field">Personal access token
      <input id="token" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" maxlength="512" />
    </label>
    <p class="hint">Use a classic personal access token or a fine-grained token limited to the organization you are cleaning up. Revoke it when the incident is over.</p>
    <ul class="scope-list">
      <li><strong>Classic:</strong> <code>repo</code> (private repositories and Actions cancel, force-cancel, re-run), <code>admin:repo_hook</code> (repository deliveries and redelivery), <code>admin:org_hook</code> (organization deliveries and redelivery), <code>read:org</code> (list repositories).</li>
      <li><strong>Fine-grained:</strong> Metadata Read; Actions Read and write; Webhooks Read and write; Administration Read when listing hooks; Organization webhooks Read and write for org hooks.</li>
      <li><strong>GitHub App:</strong> set <code>GITHUB_APP_ID</code>, the private key, and <code>GITHUB_APP_INSTALLATION_ID</code> in the environment instead of a token. App deliveries also need the app id and private key.</li>
    </ul>
    <div class="form-actions">
      <button class="btn btn-primary" id="token-save" type="submit">Use token for this process</button>
    </div>
    <p id="token-status" class="status" role="status"></p>
  </form>`
    : "";
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
<style>${flowStyles}</style>
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
  ${tokenCard}

  <form class="card" id="controls">
    <div class="card-head">
      <div>
        <h2>Window</h2>
        <p class="hint" id="window-utc-note">Presets end at the current minute. Start and end are plain UTC text: the characters you see are the characters that are sent. The browser timezone is not applied.</p>
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
      <label class="field">Window start
        <span class="utc-field">
          <input id="from" name="from" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" required placeholder="YYYY-MM-DDTHH:MM" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}" title="UTC time as YYYY-MM-DDTHH:MM. This text is sent unchanged." value="${from}" aria-describedby="window-utc-note" />
          <span class="utc-tag">UTC</span>
        </span>
      </label>
      <label class="field">Window end
        <span class="utc-field">
          <input id="to" name="to" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" required placeholder="YYYY-MM-DDTHH:MM" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}" title="UTC time as YYYY-MM-DDTHH:MM. This text is sent unchanged." value="${to}" aria-describedby="window-utc-note" />
          <span class="utc-tag">UTC</span>
        </span>
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
      <button class="btn btn-primary" id="scan-button" type="submit"${boot.needsToken ? " disabled" : ""}>Scan organization</button>
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
        <button class="btn btn-primary btn-sm" id="redeliver" type="button" disabled title="Redeliver the checked rows in the filtered list. Hidden rows are not included.">Redeliver</button>
      </div>
      <div class="filters" role="group" aria-label="Filter deliveries">
        <label class="field">Search
          <input id="delivery-search" type="search" placeholder="Repo, event, status, URL" autocomplete="off" />
        </label>
        <label class="field">Repository
          <select id="delivery-repo">
            <option value="">All repositories</option>
          </select>
        </label>
        <label class="field">Event
          <select id="delivery-event">
            <option value="">All events</option>
          </select>
        </label>
        <label class="field">Status
          <select id="delivery-status">
            <option value="">All statuses</option>
          </select>
        </label>
      </div>
      <p class="hint filter-note" id="delivery-filter-note">Redeliver uses the checked rows in this filtered list. Rows hidden by the filters are not included.</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th><input id="select-deliveries" type="checkbox" aria-label="Select all deliveries in the filtered list" /></th>
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
          <button class="btn btn-outline btn-sm" id="cancel" type="button" disabled title="Cancel the checked rows in the filtered list. Hidden rows are not included.">Cancel</button>
          <button class="btn btn-danger btn-sm" id="force-cancel" type="button" disabled title="Stops the run even when the runner does not respond. Uses the checked rows in the filtered list. Hidden rows are not included.">Force-cancel</button>
          <button class="btn btn-outline btn-sm" id="rerun" type="button" disabled title="Re-run the checked rows in the filtered list. Hidden rows are not included.">Re-run</button>
        </div>
      </div>
      <div class="filters" role="group" aria-label="Filter stuck runs">
        <label class="field">Search
          <input id="run-search" type="search" placeholder="Repo, workflow, event, status" autocomplete="off" />
        </label>
        <label class="field">Repository
          <select id="run-repo">
            <option value="">All repositories</option>
          </select>
        </label>
        <label class="field">Event
          <select id="run-event">
            <option value="">All events</option>
          </select>
        </label>
        <label class="field">Status
          <select id="run-status">
            <option value="">All statuses</option>
          </select>
        </label>
      </div>
      <p class="hint filter-note" id="run-filter-note">Cancel, force-cancel, and re-run use the checked rows in this filtered list. Rows hidden by the filters are not included.</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th><input id="select-runs" type="checkbox" aria-label="Select all stuck runs in the filtered list" /></th>
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
<p class="note">gh-aftermath ${escapeHtml(boot.version)}. A token entered on this page stays in server memory until the process stops and is not written to disk. Space toggles a checkbox. Esc closes a confirmation.</p>
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
