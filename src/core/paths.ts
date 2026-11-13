import type { ActionRequest, Operation } from "./types.js";

const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;

export function assertGitHubName(value: string, label: string): string {
  if (!GITHUB_NAME.test(value)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return value;
}

export function assertPositiveInt(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

export function actionPath(operation: Operation): ActionRequest {
  if (operation.type === "redeliver") {
    const deliveryId = assertPositiveInt(operation.deliveryId, "Delivery id");
    if (operation.scope === "repo") {
      const owner = assertGitHubName(operation.owner ?? "", "Owner");
      const repo = assertGitHubName(operation.repo ?? "", "Repository");
      const hookId = assertPositiveInt(operation.hookId ?? Number.NaN, "Hook id");
      return {
        method: "POST",
        path: `/repos/${owner}/${repo}/hooks/${hookId}/deliveries/${deliveryId}/attempts`,
      };
    }
    if (operation.scope === "org") {
      const org = assertGitHubName(operation.org ?? "", "Organization");
      const hookId = assertPositiveInt(operation.hookId ?? Number.NaN, "Hook id");
      return {
        method: "POST",
        path: `/orgs/${org}/hooks/${hookId}/deliveries/${deliveryId}/attempts`,
      };
    }
    if (operation.scope === "app") {
      return {
        method: "POST",
        path: `/app/hook/deliveries/${deliveryId}/attempts`,
      };
    }
    throw new Error("Webhook scope must be repo, org, or app.");
  }

  const owner = assertGitHubName(operation.owner, "Owner");
  const repo = assertGitHubName(operation.repo, "Repository");
  const runId = assertPositiveInt(operation.runId, "Run id");
  if (operation.type === "cancel") {
    return { method: "POST", path: `/repos/${owner}/${repo}/actions/runs/${runId}/cancel` };
  }
  if (operation.type === "force-cancel") {
    return { method: "POST", path: `/repos/${owner}/${repo}/actions/runs/${runId}/force-cancel` };
  }
  if (operation.type === "rerun") {
    return { method: "POST", path: `/repos/${owner}/${repo}/actions/runs/${runId}/rerun` };
  }
  throw new Error("Unknown recovery action.");
}

export function actionLabel(operation: Operation): string {
  if (operation.type === "redeliver") {
    if (operation.scope === "repo") {
      return `Redeliver ${operation.owner}/${operation.repo} delivery ${operation.deliveryId}`;
    }
    if (operation.scope === "org") {
      return `Redeliver ${operation.org} org hook delivery ${operation.deliveryId}`;
    }
    return `Redeliver GitHub App delivery ${operation.deliveryId}`;
  }
  const verb =
    operation.type === "cancel" ? "Cancel" : operation.type === "force-cancel" ? "Force-cancel" : "Re-run";
  return `${verb} ${operation.owner}/${operation.repo} run ${operation.runId}`;
}
