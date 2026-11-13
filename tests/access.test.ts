import { describe, expect, it } from "vitest";
import {
  formatMissingPermissions,
  formatMissingScopes,
  httpStatus,
  isCredentialFailure,
  isHookPermissionFailure,
  missingAppPermissions,
  missingClassicScopes,
  parseOAuthScopeHeader,
} from "../src/core/access.js";

describe("token access", () => {
  it("parses the X-OAuth-Scopes header and ignores a blank one", () => {
    expect(parseOAuthScopeHeader("repo, read:org, admin:repo_hook")).toEqual([
      "repo",
      "read:org",
      "admin:repo_hook",
    ]);
    expect(parseOAuthScopeHeader(null)).toBeNull();
    expect(parseOAuthScopeHeader("  ")).toBeNull();
  });

  it("names missing classic scopes and treats parent scopes as enough", () => {
    expect(missingClassicScopes(["repo", "gist"])).toEqual(["read:org", "admin:repo_hook", "admin:org_hook"]);
    expect(missingClassicScopes(["public_repo", "read:org", "admin:repo_hook", "admin:org_hook"])).toEqual(["repo"]);
    expect(missingClassicScopes(["repo", "admin:org", "write:repo_hook", "write:org_hook"])).toEqual([]);
    expect(formatMissingScopes(["admin:org_hook"])).toMatch(/scope: admin:org_hook/);
    expect(formatMissingScopes(["repo", "read:org"])).toMatch(/scopes: repo, read:org/);
  });

  it("names missing app installation permissions and lets write satisfy read", () => {
    expect(
      missingAppPermissions({
        metadata: "read",
        actions: "read",
        repository_hooks: "write",
      }),
    ).toEqual(["actions:write", "organization_hooks:write"]);
    expect(
      missingAppPermissions({
        metadata: "write",
        actions: "write",
        repository_hooks: "write",
        organization_hooks: "write",
      }),
    ).toEqual([]);
    expect(formatMissingPermissions(["actions:write"])).toMatch(/permission: actions:write/);
  });

  it("recognizes credential failures and hook permission failures", () => {
    const unauthorized = new Error("Bad credentials") as Error & { status: number };
    unauthorized.status = 401;
    expect(isCredentialFailure(unauthorized)).toBe(true);
    expect(isCredentialFailure(new Error("Bad credentials"))).toBe(true);
    expect(httpStatus({ response: { status: 404 } })).toBe(404);
    const missing = new Error("Not Found") as Error & { status: number };
    missing.status = 404;
    expect(isHookPermissionFailure(missing)).toBe(true);
    expect(isHookPermissionFailure(new Error("404"))).toBe(false);
    expect(isCredentialFailure(new Error("socket hang up"))).toBe(false);
  });
});
