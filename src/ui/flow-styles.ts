export const flowStyles = `
.filters { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.filters .field { flex: 1 1 10rem; min-width: 0; }
.filter-note { margin: 8px 0 0; }
.utc-field { display: flex; align-items: center; gap: 8px; }
.utc-tag {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0;
  color: var(--text-muted);
}
.utc-field input { font-family: var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: 0; }
.scope-list { margin: 12px 0 0; padding-left: 20px; color: var(--text-secondary); font-size: 13px; line-height: 20px; }
.scope-list li { margin: 4px 0; }
#token-form code, .hint code { font-family: var(--font-mono); font-size: 0.92em; }
`;
