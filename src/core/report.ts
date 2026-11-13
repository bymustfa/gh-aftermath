import type { ActionRecord, Report, ReportMode, ScanResult } from "./types.js";

export interface ReportInput {
  version: string;
  demo: boolean;
  org: string;
  scan: ScanResult | null;
  actions: readonly ActionRecord[];
  generatedAt?: Date;
}

function modeFor(actions: readonly ActionRecord[]): ReportMode {
  if (actions.length === 0) return "scan";
  const dry = actions.filter((action) => action.dryRun).length;
  if (dry === actions.length) return "dry-run";
  if (dry === 0) return "execute";
  return "mixed";
}

function cell(value: string | number | null | undefined): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function buildReport(input: ReportInput): Report {
  const scan = input.scan;
  const actions = [...input.actions];
  const planned = actions.filter((action) => action.dryRun && action.ok).length;
  const executed = actions.filter((action) => action.executed).length;
  const succeeded = actions.filter((action) => action.executed && action.ok).length;
  const failed = actions.filter((action) => !action.ok).length;
  return {
    product: "gh-aftermath",
    version: input.version,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    demo: input.demo,
    org: input.org,
    window: scan?.window ?? null,
    mode: modeFor(actions),
    counts: {
      repositories: scan?.counts.repositories ?? 0,
      hooks: scan?.counts.hooks ?? 0,
      deliveriesSeen: scan?.counts.deliveriesSeen ?? 0,
      failedDeliveries: scan?.counts.failedDeliveries ?? 0,
      stuckRuns: scan?.counts.stuckRuns ?? 0,
      planned,
      executed,
      succeeded,
      failed,
    },
    warnings: scan?.warnings ?? [],
    deliveries: scan?.deliveries ?? [],
    runs: scan?.runs ?? [],
    actions,
  };
}

export function reportToJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function reportToMarkdown(report: Report): string {
  const window = report.window
    ? `${report.window.from} → ${report.window.to}`
    : "not scanned";
  const lines = [
    "# gh-aftermath report",
    "",
    `- Organization: \`${cell(report.org)}\``,
    `- Window: ${window}`,
    `- Generated: ${report.generatedAt}`,
    `- Mode: ${report.mode}`,
    `- Demo: ${report.demo ? "yes" : "no"}`,
    "",
    "## Scan",
    "",
    `- Repositories: ${report.counts.repositories}`,
    `- Webhooks: ${report.counts.hooks}`,
    `- Deliveries seen in window: ${report.counts.deliveriesSeen}`,
    `- Failed or missing deliveries: ${report.counts.failedDeliveries}`,
    `- Stuck workflow runs: ${report.counts.stuckRuns}`,
    "",
    "## Failed or missing deliveries",
    "",
  ];

  if (report.deliveries.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| When | Where | Event | Result | Hook | Request path |", "| --- | --- | --- | --- | --- | --- |");
    for (const delivery of report.deliveries) {
      const where =
        delivery.scope === "repo"
          ? `${delivery.owner}/${delivery.repo}`
          : delivery.scope === "org"
            ? `${delivery.org} (org hook)`
            : "GitHub App";
      const result =
        delivery.reason === "missing_response"
          ? "no response"
          : delivery.reason === "http_error"
            ? String(delivery.statusCode)
            : delivery.status || delivery.reason;
      const path =
        delivery.scope === "repo"
          ? `POST /repos/${delivery.owner}/${delivery.repo}/hooks/${delivery.hookId}/deliveries/${delivery.id}/attempts`
          : delivery.scope === "org"
            ? `POST /orgs/${delivery.org}/hooks/${delivery.hookId}/deliveries/${delivery.id}/attempts`
            : `POST /app/hook/deliveries/${delivery.id}/attempts`;
      lines.push(
        `| ${cell(delivery.deliveredAt ?? "undated")} | ${cell(where)} | ${cell(delivery.event)} | ${cell(result)} | ${delivery.hookId} | \`${cell(path)}\` |`,
      );
    }
    lines.push("");
  }

  lines.push("## Stuck workflow runs", "");
  if (report.runs.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| When | Run | Workflow | Status | Why |", "| --- | --- | --- | --- | --- |");
    for (const run of report.runs) {
      lines.push(
        `| ${cell(run.createdAt)} | ${cell(`${run.owner}/${run.repo} #${run.id}`)} | ${cell(run.name)} | ${cell(run.status)} | ${cell(run.reason)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Actions", "");
  lines.push(
    `- Planned: ${report.counts.planned}`,
    `- Executed: ${report.counts.executed}`,
    `- Succeeded: ${report.counts.succeeded}`,
    `- Failed: ${report.counts.failed}`,
    "",
  );
  if (report.actions.length === 0) {
    lines.push("No actions yet. Dry-run is the default: nothing is sent to GitHub until you turn it off.", "");
  } else {
    lines.push("| Result | Action | Request | Detail |", "| --- | --- | --- | --- |");
    for (const action of report.actions) {
      const result = !action.ok ? "failed" : action.dryRun ? "planned" : "done";
      lines.push(
        `| ${result} | ${cell(action.label)} | \`${action.request.method} ${cell(action.request.path)}\` | ${cell(action.error ?? (action.dryRun ? "dry-run" : "sent"))} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Warnings", "");
  if (report.warnings.length === 0) lines.push("None.", "");
  else {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
