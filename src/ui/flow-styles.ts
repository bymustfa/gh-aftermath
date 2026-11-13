export const flowStyles = `
.filters { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.filters .field { flex: 1 1 9.5rem; min-width: 0; }
.filter-note { margin: 8px 0 0; }
.utc-field { display: flex; align-items: center; gap: 8px; }
.utc-tag {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--secondary-foreground);
  background: var(--secondary);
  border-radius: 999px;
  padding: 4px 8px;
}
.filters input,
.filters select,
.utc-field input,
#token-form input[type="password"] {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-control);
  border: 1px solid var(--input);
  background: var(--card);
  color: var(--foreground);
  padding: 0 14px;
}
.utc-field input { font-family: var(--font-mono); }
.scope-list { margin: 10px 0 0; padding-left: 18px; color: var(--muted-foreground); font-size: 13px; }
.scope-list li { margin: 4px 0; }
#token-form code, .hint code { font-family: var(--font-mono); font-size: 0.92em; }
`;
