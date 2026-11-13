export class AccessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

interface ClassicScope {
  name: string;
  satisfiedBy: readonly string[];
}

/** Classic PAT scopes this scan needs. Parents count: `admin:org` covers `read:org`. */
export const REQUIRED_CLASSIC_SCOPES: readonly ClassicScope[] = [
  { name: "repo", satisfiedBy: ["repo"] },
  { name: "read:org", satisfiedBy: ["read:org", "write:org", "admin:org"] },
  { name: "admin:repo_hook", satisfiedBy: ["admin:repo_hook", "write:repo_hook"] },
  { name: "admin:org_hook", satisfiedBy: ["admin:org_hook", "write:org_hook"] },
];

interface AppPermission {
  name: string;
  key: string;
  minimum: "read" | "write";
}

/** GitHub App installation permissions. `write` satisfies `read`. */
export const REQUIRED_APP_PERMISSIONS: readonly AppPermission[] = [
  { name: "actions:write", key: "actions", minimum: "write" },
  { name: "metadata:read", key: "metadata", minimum: "read" },
  { name: "repository_hooks:write", key: "repository_hooks", minimum: "write" },
  { name: "organization_hooks:write", key: "organization_hooks", minimum: "write" },
];

const ACCESS_RANK: Record<string, number> = { read: 1, write: 2 };

export function parseOAuthScopeHeader(value: string | null | undefined): string[] | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .split(",")
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);
}

export function missingClassicScopes(granted: readonly string[]): string[] {
  const have = new Set(granted.map((scope) => scope.toLowerCase()));
  return REQUIRED_CLASSIC_SCOPES.filter((scope) => !scope.satisfiedBy.some((name) => have.has(name))).map(
    (scope) => scope.name,
  );
}

export function formatMissingScopes(missing: readonly string[]): string {
  const noun = missing.length === 1 ? "scope" : "scopes";
  return `The token is missing GitHub ${noun}: ${missing.join(", ")}. The scan was stopped.`;
}

export function missingAppPermissions(permissions: Readonly<Record<string, string | undefined>>): string[] {
  return REQUIRED_APP_PERMISSIONS.filter((permission) => {
    const granted = permissions[permission.key]?.toLowerCase() ?? "";
    const rank = ACCESS_RANK[granted] ?? 0;
    return rank < (ACCESS_RANK[permission.minimum] ?? 0);
  }).map((permission) => permission.name);
}

export function formatMissingPermissions(missing: readonly string[]): string {
  const noun = missing.length === 1 ? "permission" : "permissions";
  return `The GitHub App installation is missing ${noun}: ${missing.join(", ")}. The scan was stopped.`;
}

export function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  if (typeof record.status === "number") return record.status;
  if (typeof record.statusCode === "number") return record.statusCode;
  if (record.response && typeof record.response.status === "number") return record.response.status;
  return undefined;
}

export function isCredentialFailure(error: unknown): boolean {
  if (httpStatus(error) === 401) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /bad credentials/i.test(message);
}

export function credentialError(): AccessError {
  return new AccessError("GitHub rejected the token (Bad credentials). The scan was stopped.", 401);
}

export function isHookPermissionFailure(error: unknown): boolean {
  const status = httpStatus(error);
  return status === 403 || status === 404;
}

export function orgHookPermissionError(status: number): AccessError {
  return new AccessError(
    `GitHub refused organization webhooks (${status}). The token is missing the admin:org_hook scope. A GitHub App installation needs organization_hooks:write. The scan was stopped.`,
    403,
  );
}

export function repoHookPermissionError(statusLabel: string): AccessError {
  return new AccessError(
    `GitHub refused repository webhooks (${statusLabel}). The token is missing the admin:repo_hook scope. A GitHub App installation needs repository_hooks:write. The scan was stopped.`,
    403,
  );
}

export function readHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") return null;
  if ("get" in headers && typeof headers.get === "function") {
    const value = (headers as Headers).get(name);
    return typeof value === "string" ? value : null;
  }
  const record = headers as Record<string, unknown>;
  const value = record[name.toLowerCase()] ?? record[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value.join(", ");
  return null;
}
