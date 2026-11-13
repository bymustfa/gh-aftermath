export const styles = `
:root {
  --paper: #e6eef2;
  --sheet: #f8fbfc;
  --ink: #1a2833;
  --muted: #5c7080;
  --line: #c9d7df;
  --copper: #c24e24;
  --copper-ink: #8c3514;
  --copper-soft: #f8e7de;
  --pine: #1c6b45;
  --pine-soft: #e6f5ec;
  --fail: #a33b32;
  --fail-soft: #fbeceb;
  --sea: #1f5f78;
  --sea-soft: #e6f3f8;
  --queued: #8a5a12;
  --queued-soft: #f8f1de;
  --focus: #c24e24;
  color-scheme: light;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: Cantarell, "Avenir Next", "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.45;
}
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.wrap { width: min(1240px, calc(100% - 32px)); margin: 0 auto; }
header.top {
  background: var(--sheet);
  border-bottom: 1px solid var(--line);
}
.top-inner {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-end;
  padding: 18px 0 16px;
}
.brand { display: flex; gap: 12px; align-items: flex-start; max-width: 760px; }
.mark {
  width: 16px;
  height: 16px;
  margin-top: 8px;
  background: var(--copper);
  flex: none;
}
h1 {
  margin: 0;
  font-family: "Liberation Serif", "Iowan Old Style", Palatino, "Palatino Linotype", "Times New Roman", serif;
  font-size: 2rem;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1;
}
.lede { margin: 6px 0 0; color: var(--muted); max-width: 62ch; }
.side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.stamp {
  border: 1.5px solid var(--copper);
  color: var(--copper-ink);
  background: var(--copper-soft);
  padding: 4px 10px;
  font-weight: 600;
}
.stamp.live {
  border-color: var(--pine);
  color: var(--pine);
  background: var(--pine-soft);
}
.meta { color: var(--muted); font-size: 0.85rem; }
.banner {
  width: min(1240px, calc(100% - 32px));
  margin: 14px auto 0;
  background: var(--queued-soft);
  color: var(--queued);
  border: 1px solid #ead7a8;
  padding: 8px 12px;
}
.panel {
  background: var(--sheet);
  border: 1px solid var(--line);
  padding: 14px;
  margin-top: 14px;
}
form.controls {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr auto;
  gap: 10px 12px;
  align-items: end;
}
label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 0.86rem; }
input[type="text"], input[type="datetime-local"], input[type="number"] {
  background: white;
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 7px 8px;
  color: var(--ink);
}
.checks { display: flex; gap: 14px; align-items: center; min-height: 36px; }
.checks label { flex-direction: row; align-items: center; gap: 6px; color: var(--ink); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
button.primary, button.secondary, button.quiet, a.button {
  border-radius: 3px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  background: white;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
button.primary { background: var(--copper); border-color: var(--copper); color: white; font-weight: 600; }
button.secondary { background: white; }
button.danger { color: var(--fail); border-color: #e3b6b1; }
button.quiet { border-color: transparent; background: transparent; color: var(--sea); padding-inline: 4px; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
.presets { display: flex; gap: 8px; flex-wrap: wrap; grid-column: 1 / -1; }
.help { grid-column: 1 / -1; margin: 0; color: var(--muted); }
#status { min-height: 1.2em; margin: 8px 0 0; }
#status.error { color: var(--fail); }
.warnings { margin: 8px 0 0; padding-left: 18px; color: var(--queued); }
.timeline-head, .board-head, .report-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  flex-wrap: wrap;
}
h2 { margin: 0; font-size: 1.05rem; font-weight: 600; }
.legend { display: flex; gap: 14px; color: var(--muted); font-size: 0.85rem; }
.swatch { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
.swatch.delivery { background: var(--copper); }
.swatch.run { background: var(--sea); }
svg#timeline { width: 100%; height: 78px; display: block; margin-top: 6px; }
.axis { stroke: var(--line); stroke-width: 2; }
.lane { fill: var(--muted); font-size: 11px; font-family: Cantarell, sans-serif; }
.tick-delivery { fill: var(--copper); }
.tick-run { fill: var(--sea); }
.times { display: flex; justify-content: space-between; color: var(--muted); font-family: "JetBrains Mono", "Cascadia Mono", ui-monospace, monospace; font-size: 0.75rem; }
.boards { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 14px; }
.board-head .actions { justify-content: flex-end; }
.table-scroll { max-height: 320px; overflow: auto; margin-top: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { position: sticky; top: 0; background: #eef5f7; color: var(--muted); font-weight: 600; font-size: 0.8rem; }
tr.selected td { background: #fff6f1; }
.mono { font-family: "JetBrains Mono", "Cascadia Mono", ui-monospace, monospace; font-size: 0.78rem; }
.sub { display: block; color: var(--muted); }
.pill { display: inline-block; padding: 0 6px; border-radius: 999px; background: var(--fail-soft); color: var(--fail); }
.pill.ok { background: var(--pine-soft); color: var(--pine); }
.pill.wait { background: var(--queued-soft); color: var(--queued); }
.pill.run { background: var(--sea-soft); color: var(--sea); }
.empty { color: var(--muted); padding: 16px 8px; }
a { color: var(--sea); }
pre#report {
  margin: 10px 0 0;
  max-height: 240px;
  overflow: auto;
  background: #102029;
  color: #e7f0f4;
  padding: 12px;
  font-family: "JetBrains Mono", "Cascadia Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
  white-space: pre-wrap;
}
footer {
  width: min(1240px, calc(100% - 32px));
  margin: 16px auto 28px;
  color: var(--muted);
  font-size: 0.85rem;
}
@media (max-width: 980px) {
  form.controls, .boards { grid-template-columns: 1fr; }
  .top-inner, .side { align-items: flex-start; }
  .side { align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; transition: none !important; }
}
`;
