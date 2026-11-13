export const styles = `
@font-face { font-family: Inter; src: url("/fonts/inter-400.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: Inter; src: url("/fonts/inter-500.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: Inter; src: url("/fonts/inter-600.woff2") format("woff2"); font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Bricolage Grotesque"; src: url("/fonts/bricolage-500.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Bricolage Grotesque"; src: url("/fonts/bricolage-600.woff2") format("woff2"); font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Bricolage Grotesque"; src: url("/fonts/bricolage-700.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }

:root {
  --font-body: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-display: "Bricolage Grotesque", Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Mono", ui-monospace, monospace;
  --background: #f7f5ff;
  --foreground: #13111c;
  --card: #ffffff;
  --card-foreground: #13111c;
  --muted: #f3f0fb;
  --muted-foreground: #615f72;
  --secondary: #eeeaff;
  --secondary-foreground: #5b3df5;
  --primary: #5b3df5;
  --primary-foreground: #ffffff;
  --primary-text: #5b3df5;
  --border: #e8e6f0;
  --input: #e8e6f0;
  --ring: #5b3df5;
  --destructive: #df0013;
  --destructive-fill: #df0013;
  --destructive-soft: #fff1f2;
  --lime: #d9f85f;
  --inverse: #13111c;
  --sky: #0ea5e9;
  --sky-text: #0369a1;
  --sky-soft: #e7f6ff;
  --ok: #047857;
  --ok-soft: #ecfdf5;
  --radius: 0.75rem;
  --radius-control: 16.8px;
  --radius-card: 24px;
  --shadow-nav: 0 8px 30px -12px rgba(37, 22, 120, 0.22);
  --shadow-card: 0 1px 2px rgba(19, 17, 28, 0.04), 0 12px 32px -24px rgba(37, 22, 120, 0.35);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  color-scheme: light;
}
[data-theme="dark"] {
  --background: #100e18;
  --foreground: #f4f1fb;
  --card: #1b1826;
  --card-foreground: #f4f1fb;
  --muted: #241f33;
  --muted-foreground: #b3adc6;
  --secondary: #2a2444;
  --secondary-foreground: #d9d4ff;
  --primary: #7058e6;
  --primary-foreground: #ffffff;
  --primary-text: #9d89ff;
  --border: #3a3450;
  --input: #3a3450;
  --ring: #9b8cff;
  --destructive: #ff5d6c;
  --destructive-fill: #df0013;
  --destructive-soft: #3a1820;
  --inverse: #13111c;
  --sky-text: #0ea5e9;
  --sky-soft: #163044;
  --ok: #7dcea0;
  --ok-soft: #143028;
  --shadow-nav: 0 8px 30px -12px rgba(0, 0, 0, 0.55);
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3), 0 16px 36px -24px rgba(0, 0, 0, 0.7);
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { scroll-padding-top: 112px; }
h1, h2, .card { scroll-margin-top: 12px; }
body {
  min-height: 100vh;
  color: var(--foreground);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.5;
  background:
    radial-gradient(880px 420px at 110% -8%, color-mix(in srgb, var(--secondary) 90%, white) 0%, transparent 58%),
    radial-gradient(640px 360px at -12% -4%, color-mix(in srgb, var(--lime) 35%, var(--background)) 0%, transparent 52%),
    var(--background);
}
button, input, select, summary { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 45%, transparent);
}
.skip {
  position: absolute;
  left: 12px;
  top: -40px;
  background: var(--foreground);
  color: var(--background);
  padding: 8px 12px;
  border-radius: 999px;
  z-index: 5;
}
.skip:focus { top: 12px; }
.nav-wrap {
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 16px 16px 12px;
  background-color: var(--background);
  background-image:
    radial-gradient(880px 420px at 110% -8%, color-mix(in srgb, var(--secondary) 90%, white) 0%, transparent 58%),
    radial-gradient(640px 360px at -12% -4%, color-mix(in srgb, var(--lime) 35%, var(--background)) 0%, transparent 52%);
  background-repeat: no-repeat;
}
.nav {
  width: min(1120px, 100%);
  margin: 0 auto;
  min-height: 64px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 10px 8px 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: var(--shadow-nav);
}
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; text-decoration: none; color: inherit; }
.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: var(--primary);
  box-shadow: inset 0 0 0 6px color-mix(in srgb, white 18%, transparent);
}
.brand-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 18px;
  letter-spacing: -0.04em;
}
.nav-actions { display: flex; align-items: center; gap: 8px; min-width: 0; }
.meta {
  color: var(--muted-foreground);
  font-size: 13px;
  padding-right: 4px;
  min-width: 0;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stamp {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--inverse);
  color: var(--lime);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.stamp.live { background: var(--destructive-fill); color: var(--primary-foreground); }
.page { width: min(1120px, calc(100% - 32px)); min-width: 0; margin: 0 auto; padding: 28px 0 48px; }
.banner {
  margin-bottom: 18px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-weight: 500;
}
.page-head { max-width: 680px; margin-bottom: 22px; }
h1 {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(36px, 5vw, 52px);
  line-height: 1.05;
  letter-spacing: -0.04em;
}
.lede { margin: 10px 0 0; color: var(--muted-foreground); font-size: 16px; max-width: 58ch; }
.card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 20px;
  margin-top: 16px;
}
.card-head, .report-head, .board-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.section-kicker { margin: 0 0 4px; color: var(--primary-text); font-size: 13px; font-weight: 600; }
.grid-form {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr;
  gap: 14px;
  margin-top: 16px;
}
.grid-form > * { min-width: 0; }
label.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 500; }
.hint, .field span.hint { color: var(--muted-foreground); font-weight: 400; font-size: 13px; }
input[type="text"], input[type="datetime-local"], input[type="number"] {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 44px;
  border-radius: var(--radius-control);
  border: 1px solid var(--input);
  background: var(--card);
  color: var(--foreground);
  padding: 0 14px;
}
input:focus-visible { border-color: var(--primary); }
.presets { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.preset {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  font-weight: 500;
}
.preset[aria-pressed="true"] { background: var(--foreground); color: var(--background); border-color: var(--foreground); }
.switch-row { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; margin-top: 16px; }
.switch { display: flex; gap: 10px; align-items: flex-start; font-weight: 500; }
.switch input { margin-top: 3px; accent-color: var(--primary); }
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
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: var(--primary-foreground); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--primary) 88%, black); }
.btn-dark { background: var(--foreground); color: var(--background); }
.btn-outline { background: var(--card); border-color: var(--border); color: var(--foreground); }
.btn-outline:hover:not(:disabled) { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
.btn-ghost { height: 36px; padding: 0 12px; border-radius: 12px; color: var(--muted-foreground); }
.btn-ghost:hover { color: var(--primary-text); background: transparent; }
.btn-danger { background: var(--card); border-color: color-mix(in srgb, var(--destructive) 45%, var(--border)); color: var(--destructive); }
.btn-sm { height: 36px; padding: 0 12px; font-size: 14px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.status { min-height: 1.4em; margin: 12px 0 0; color: var(--muted-foreground); }
.status.error { color: var(--destructive); }
.warnings { margin: 8px 0 0; padding-left: 18px; color: #8a5a12; }
[data-theme="dark"] .warnings { color: #f0c36a; }
details.advanced { margin-top: 14px; }
details.advanced summary { cursor: pointer; color: var(--muted-foreground); font-weight: 500; }
.advanced-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; max-width: 520px; }
.legend { display: flex; gap: 14px; color: var(--muted-foreground); font-size: 13px; }
.swatch { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.swatch.delivery { background: var(--primary); }
.swatch.run { background: var(--sky); }
svg#timeline { width: 100%; height: 78px; display: block; margin-top: 8px; }
.axis { stroke: var(--border); stroke-width: 2; }
.lane { fill: var(--muted-foreground); font-size: 11px; font-family: var(--font-body); }
.tick-delivery { fill: var(--primary); }
.tick-run { fill: var(--sky); }
.times { display: flex; justify-content: space-between; color: var(--muted-foreground); font-family: var(--font-mono); font-size: 12px; }
.boards { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; min-width: 0; }
.boards > * { min-width: 0; }
.count { color: var(--muted-foreground); font-family: var(--font-body); font-weight: 500; font-size: 16px; letter-spacing: 0; }
.table-scroll { position: relative; max-height: 360px; max-width: 100%; min-width: 0; overflow: auto; margin-top: 12px; }
table { width: 100%; border-collapse: collapse; }
.deliveries { table-layout: fixed; }
.deliveries th:nth-child(1) { width: 2.75rem; }
.deliveries th:nth-child(2) { width: 11.5rem; }
.table-scroll td.when { white-space: nowrap; font-variant-numeric: tabular-nums; }
.deliveries th:nth-child(4) { width: 18%; }
.deliveries th:nth-child(5) { width: 5.75rem; }
.runs { table-layout: fixed; width: 100%; }
.runs th:nth-child(1) { width: 2.25rem; }
.runs th:nth-child(5) { width: 6.25rem; }
.runs th:nth-child(6) { width: 3rem; }
.table-scroll .mono { white-space: normal; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { position: sticky; top: 0; background: var(--card); color: var(--muted-foreground); font-size: 12px; font-weight: 600; }
tr.selected td { background: var(--secondary); }
.mono { font-family: var(--font-mono); font-size: 12px; white-space: nowrap; }
.sub {
  display: block;
  max-width: 100%;
  color: var(--muted-foreground);
  font-weight: 400;
  font-size: 12px;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: var(--destructive-soft);
  color: var(--destructive);
}
.badge.wait { background: var(--secondary); color: var(--secondary-foreground); }
.badge.run { background: var(--sky-soft); color: var(--sky-text); }
.empty { color: var(--muted-foreground); padding: 22px 8px; }
.empty strong { display: block; color: var(--foreground); font-family: var(--font-display); font-size: 18px; letter-spacing: -0.03em; margin-bottom: 4px; }
a { color: var(--primary-text); }
pre#report {
  margin: 12px 0 0;
  max-height: 280px;
  max-width: 100%;
  overflow: auto;
  background: var(--inverse);
  color: #f4f1fb;
  border-radius: 16px;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
pre#report:focus-visible {
  outline: 3px solid var(--lime);
  outline-offset: 3px;
  box-shadow: none;
}
dialog {
  width: min(440px, calc(100% - 32px));
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 0;
  background: var(--card);
  color: var(--card-foreground);
  box-shadow: var(--shadow-nav);
}
dialog::backdrop { background: rgba(19, 17, 28, 0.48); }
.dialog-card { padding: 24px; }
.dialog-card h2 { font-size: 28px; }
.dialog-card p { color: var(--muted-foreground); }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.toast { display: none; }
.toast.error { display: none; }
footer.note {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto 28px;
  color: var(--muted-foreground);
  font-size: 13px;
}
@media (max-width: 900px) {
  .grid-form, .boards, .advanced-grid { grid-template-columns: 1fr; }
  .nav { border-radius: 18px; }
  h1 { font-size: 36px; }
}
@media (max-width: 720px) {
  html { scroll-padding-top: 128px; }
  h1, h2, .card { scroll-margin-top: 8px; }
  .nav {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    column-gap: 8px;
    row-gap: 6px;
    padding: 8px 10px 8px 12px;
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
    margin: 0 0 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 16px;
  }
  .deliveries td, .runs td {
    display: block;
    width: auto;
    padding: 3px 0;
    border: 0;
  }
  .deliveries td:first-child, .runs td:first-child { padding-bottom: 6px; }
  .table-scroll .mono { white-space: normal; }
  .deliveries td:nth-child(n+2)::before,
  .runs td:nth-child(n+2)::before {
    display: block;
    margin-bottom: 1px;
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 600;
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
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; scroll-behavior: auto !important; }
}
`;
