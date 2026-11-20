export const styles = `
@font-face { font-family: "IBM Plex Sans"; src: url("/fonts/plex-sans-400.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "IBM Plex Sans"; src: url("/fonts/plex-sans-500.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/fonts/plex-mono-400.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/fonts/plex-mono-500.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }

:root {
  --font-body: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --bg: #fafafa;
  --card: #ffffff;
  --raised: #f4f4f5;
  --selected: #e7e7ea;
  --text: #171717;
  --text-secondary: #3f3f3f;
  --text-muted: #5e5e5e;
  --hairline: rgba(23, 23, 23, 0.08);
  --hairline-strong: rgba(23, 23, 23, 0.16);
  --accent: #b45309;
  --danger: #b91c1c;
  --danger-soft: #fde8e8;
  --run: #3e6a84;
  --run-soft: #e7eef2;
  --warn: #9a3412;
  --ring: #9a3412;
  --plot: #f4f4f5;
  --log: #171717;
  --log-text: #ededed;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  --radius-control: 8px;
  --radius-card: 16px;
  color-scheme: light;
}
[data-theme="dark"] {
  --bg: #141415;
  --card: #19191b;
  --raised: #232325;
  --selected: #2c2c30;
  --text: #ededed;
  --text-secondary: #a1a1a6;
  --text-muted: #9a9aa2;
  --hairline: rgba(237, 237, 237, 0.08);
  --hairline-strong: rgba(237, 237, 237, 0.16);
  --accent: #f0b429;
  --danger: #ff8d8d;
  --danger-soft: #3f2224;
  --run: #9bb8c9;
  --run-soft: #1c2830;
  --warn: #f0b429;
  --ring: #f0b429;
  --plot: #141416;
  --log: #0f0f10;
  --log-text: #ededed;
  --shadow: none;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { scroll-padding-top: 80px; }
h1, h2, .card { scroll-margin-top: 16px; }
body {
  min-height: 100vh;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
  background: var(--bg);
}
button, input, select, summary { font: inherit; color: inherit; }
button { cursor: pointer; }
::placeholder { color: var(--text-muted); opacity: 1; }
::selection { background: var(--selected); color: var(--text); }
:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 2px;
}
.skip {
  position: absolute;
  left: 16px;
  top: -48px;
  background: var(--text);
  color: var(--bg);
  padding: 8px 12px;
  border-radius: 8px;
  z-index: 5;
  text-decoration: none;
}
.skip:focus { top: 12px; }
.nav-wrap {
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--bg);
  border-bottom: 1px solid var(--hairline);
}
.nav {
  width: min(1440px, calc(100% - 64px));
  margin: 0 auto;
  min-height: 64px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  background: transparent;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}
.brand-mark { width: 16px; height: 16px; flex: 0 0 auto; display: block; }
.brand-name {
  font-weight: 500;
  font-size: 16px;
  letter-spacing: 0;
  line-height: 1;
}
.nav-actions { display: flex; align-items: center; gap: 8px; min-width: 0; }
.meta {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  padding-right: 4px;
  min-width: 0;
  max-width: 16rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stamp {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--hairline);
  background: var(--raised);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}
.stamp::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex: 0 0 auto;
}
.stamp.live {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: transparent;
}
.stamp.live::before { background: var(--danger); }
.page { width: min(1440px, calc(100% - 64px)); min-width: 0; margin: 0 auto; padding: 32px 0 48px; }
.banner {
  margin: 0 0 24px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--hairline);
  background: var(--card);
  color: var(--text);
  font-weight: 400;
}
.page-head { max-width: 40rem; margin: 0 0 32px; }
h1 {
  margin: 0;
  font-weight: 500;
  font-size: 36px;
  line-height: 1.15;
  letter-spacing: 0;
}
.lede { margin: 8px 0 0; color: var(--text-secondary); font-size: 16px; line-height: 24px; max-width: 42rem; }
.card {
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  padding: 24px;
  margin-top: 32px;
}
.page-head + .card,
.banner + .page-head { margin-top: 0; }
.card-head, .report-head, .board-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0;
}
.section-kicker { margin: 0 0 8px; color: var(--text-muted); font-size: 13px; font-weight: 400; line-height: 20px; letter-spacing: 0; }
.grid-form {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.grid-form > * { min-width: 0; }
label.field { display: flex; flex-direction: column; gap: 8px; font-size: 14px; font-weight: 500; line-height: 20px; }
.hint, .field span.hint { color: var(--text-muted); font-weight: 400; font-size: 13px; line-height: 20px; }
input[type="text"], input[type="search"], input[type="password"], input[type="number"], select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 44px;
  border-radius: var(--radius-control);
  border: 1px solid var(--hairline-strong);
  background: var(--raised);
  color: var(--text);
  padding: 0 12px;
}
input:focus-visible, select:focus-visible { border-color: var(--text); }
.presets { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.preset {
  height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-control);
  border: 1px solid var(--hairline-strong);
  background: var(--card);
  color: var(--text);
  font-weight: 500;
  font-size: 14px;
}
.preset:hover { background: var(--raised); }
.preset[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
.switch-row { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-start; margin-top: 16px; }
.switch { display: flex; gap: 8px; align-items: flex-start; font-weight: 500; }
.switch input { margin-top: 4px; accent-color: var(--accent); }
/* Dry run and Scan come before the datetime fields in the DOM so those fields' internal stops do not bury the primary actions. Visual order stays put. */
#controls { display: flex; flex-direction: column; }
#controls .grid-form { order: 1; }
#controls .switch-row { order: 2; }
#controls .advanced { order: 3; }
#controls .form-actions { order: 4; }
#controls .status { order: 5; }
#controls .warnings { order: 6; }
.form-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 16px;
  border-radius: var(--radius-control);
  border: 1px solid transparent;
  background: transparent;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 160ms var(--ease), color 160ms var(--ease), border-color 160ms var(--ease), transform 160ms var(--ease);
}
.btn:active:not(:disabled) { transform: scale(0.98); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: var(--text); color: var(--bg); }
.btn-primary:hover:not(:disabled) { background: var(--text-secondary); }
[data-theme="dark"] .btn-primary:hover:not(:disabled) { background: #ffffff; }
.btn-outline { background: var(--card); border-color: var(--hairline-strong); color: var(--text); }
.btn-outline:hover:not(:disabled) { background: var(--raised); }
.btn-ghost { height: 36px; padding: 0 12px; color: var(--text-secondary); }
.btn-ghost:hover { color: var(--text); background: var(--raised); }
.btn-danger { background: var(--card); border-color: var(--hairline-strong); color: var(--danger); }
.btn-danger:hover:not(:disabled) { background: var(--danger-soft); }
.btn-sm { height: 36px; padding: 0 12px; font-size: 14px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.status { min-height: 1.4em; margin: 12px 0 0; color: var(--text-secondary); }
.status.error { color: var(--danger); }
.warnings { margin: 8px 0 0; padding-left: 20px; color: var(--warn); }
details.advanced { margin-top: 16px; }
details.advanced summary { cursor: pointer; color: var(--text-secondary); font-weight: 500; }
.advanced-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; max-width: 520px; }
.legend { display: flex; gap: 16px; color: var(--text-secondary); font-size: 13px; line-height: 20px; }
.swatch { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
.swatch.delivery { background: var(--accent); }
.swatch.run { background: var(--run); }
.timeline { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.lane-row { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: center; }
.lane-name { font-family: var(--font-mono); font-size: 12px; line-height: 16px; color: var(--text-muted); }
.lane-plot {
  position: relative;
  height: 36px;
  border-radius: 8px;
  background:
    linear-gradient(var(--text-muted), var(--text-muted)) left 8px center / 1.5px 12px no-repeat,
    linear-gradient(var(--text-muted), var(--text-muted)) right 8px center / 1.5px 12px no-repeat,
    linear-gradient(var(--hairline-strong), var(--hairline-strong)) left 8px center / calc(100% - 16px) 1px no-repeat,
    var(--plot);
}
.tick {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  margin-left: -5px;
  border-radius: 50%;
}
.tick.delivery { background: var(--accent); }
.tick.run { width: 8px; height: 8px; margin-top: -4px; margin-left: -4px; background: var(--run); }
.times {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
  margin-left: 108px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
.boards { display: grid; grid-template-columns: 1fr; gap: 32px; min-width: 0; margin-top: 32px; }
.boards > * { min-width: 0; }
.boards > .card { margin-top: 0; }
.count {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 13px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.table-scroll { position: relative; max-height: 360px; max-width: 100%; min-width: 0; overflow: auto; margin-top: 12px; }
table { width: 100%; border-collapse: collapse; }
.deliveries, .runs { table-layout: fixed; width: 100%; }
.deliveries th:nth-child(1),
.runs th:nth-child(1) { width: 2.5rem; }
.deliveries th:nth-child(2),
.runs th:nth-child(2) { width: 8rem; }
.deliveries th:nth-child(3) { width: 34%; }
.runs th:nth-child(3),
.runs th:nth-child(4) { width: 24%; }
.deliveries th:nth-child(4) { width: 22%; }
.deliveries th:nth-child(5),
.runs th:nth-child(5) { width: 7rem; }
.runs th:nth-child(6) { width: 4.5rem; }
.deliveries thead th:first-child,
.deliveries tbody td:first-child,
.runs thead th:first-child,
.runs tbody td:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--card);
}
.deliveries thead th:first-child,
.runs thead th:first-child { z-index: 2; background: var(--raised); }
tr.selected td:first-child { background: var(--selected); }
td.when, td.mono, .mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.when-date, .when-time { display: block; white-space: nowrap; line-height: 1.35; }
.place { display: block; max-width: 100%; overflow-wrap: normal; word-break: normal; }
.table-scroll .mono { white-space: normal; }
th, td { text-align: left; padding: 12px 8px; border-bottom: 1px solid var(--hairline); vertical-align: top; }
th {
  position: sticky;
  top: 0;
  background: var(--raised);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
}
tbody td { transition: background-color 160ms var(--ease); }
tbody tr:hover td { background: var(--raised); }
tr.selected td, tr.selected:hover td { background: var(--selected); }
.mono { font-size: 12px; white-space: nowrap; }
.sub {
  display: block;
  max-width: 100%;
  color: var(--text-muted);
  font-weight: 400;
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  background: var(--danger-soft);
  color: var(--danger);
}
.badge.wait { background: var(--raised); color: var(--text-secondary); }
.badge.run { background: var(--run-soft); color: var(--run); }
.empty { color: var(--text-secondary); padding: 24px 8px; }
.empty strong { display: block; color: var(--text); font-size: 16px; font-weight: 500; letter-spacing: 0; margin-bottom: 4px; }
a { color: inherit; }
td a, .scope-list a { text-decoration: underline; text-underline-offset: 2px; }
pre#report {
  margin: 16px 0 0;
  max-height: 280px;
  max-width: 100%;
  overflow: auto;
  background: var(--log);
  color: var(--log-text);
  border-radius: 12px;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
pre#report:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}
dialog {
  width: min(440px, calc(100% - 32px));
  border: 1px solid var(--hairline);
  border-radius: var(--radius-card);
  padding: 0;
  background: var(--card);
  color: var(--text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}
[data-theme="dark"] dialog { box-shadow: none; }
dialog::backdrop { background: rgba(0, 0, 0, 0.48); }
.dialog-card { padding: 24px; }
.dialog-card h2 { font-size: 28px; font-weight: 500; letter-spacing: 0; line-height: 1.15; }
.dialog-card p { color: var(--text-secondary); }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.toast { display: none; }
.toast.error { display: none; }
p.note {
  width: min(1440px, calc(100% - 64px));
  margin: 32px auto 32px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 20px;
}
@media (max-width: 900px) {
  .grid-form, .advanced-grid { grid-template-columns: 1fr; }
  .nav, .page, p.note { width: min(1440px, calc(100% - 32px)); }
  h1 { font-size: 32px; }
}
@media (max-width: 720px) {
  html { scroll-padding-top: 96px; }
  .card { padding: 16px; border-radius: 12px; }
  .lane-row { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .times { margin-left: 0; }
  .nav {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    column-gap: 8px;
    row-gap: 8px;
    min-height: 56px;
    padding: 12px 0;
  }
  .nav-actions { display: contents; }
  .brand { grid-column: 1; grid-row: 1; }
  .brand-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #theme-toggle { grid-column: 2; grid-row: 1; }
  #stamp { grid-column: 3; grid-row: 1; }
  #rate-limit {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: end;
    max-width: 100%;
    text-align: right;
  }
  #rate-limit:empty { display: none; }
  .form-actions .btn { width: 100%; }
  .board-head, .report-head {
    flex-direction: column;
    align-items: stretch;
  }
  .board-head > .btn { align-self: flex-start; }
  .actions { width: 100%; }
  .actions .btn { flex: 1 1 8rem; }
  .deliveries, .runs { display: block; table-layout: auto; }
  .deliveries thead, .runs thead {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .deliveries tbody, .runs tbody,
  .deliveries tr, .runs tr { display: block; }
  .deliveries tr, .runs tr {
    margin: 0 0 8px;
    padding: 12px;
    border: 1px solid var(--hairline);
    border-radius: 8px;
    background: var(--card);
  }
  .deliveries td, .runs td,
  .deliveries th, .runs th {
    display: block;
    position: static;
    width: auto;
    padding: 4px 0;
    border: 0;
    background: transparent;
  }
  .deliveries td:first-child, .runs td:first-child { padding-bottom: 8px; }
  .table-scroll .mono { white-space: normal; }
  .deliveries td:nth-child(n+2)::before,
  .runs td:nth-child(n+2)::before {
    display: block;
    margin-bottom: 2px;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0;
  }
  .deliveries td:nth-child(2)::before { content: "When"; }
  .deliveries td:nth-child(3)::before { content: "Where"; }
  .deliveries td:nth-child(4)::before { content: "Event"; }
  .deliveries td:nth-child(5)::before { content: "Result"; }
  .runs td:nth-child(2)::before { content: "When"; }
  .runs td:nth-child(3)::before { content: "Repository"; }
  .runs td:nth-child(4)::before { content: "Workflow"; }
  .runs td:nth-child(5)::before { content: "Status"; }
  .runs td:nth-child(6)::before { content: "Age"; }
  td.empty { padding: 12px 0; }
  td.empty::before { content: none; display: none; }
  .sub {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    overflow: hidden;
  }
  tr.selected td, tbody tr:hover td { background: transparent; }
  tr.selected { background: var(--selected); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; scroll-behavior: auto !important; }
}
`;
