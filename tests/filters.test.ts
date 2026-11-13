import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  deliveryChoices,
  deliveryPlace,
  deliveryResult,
  filterDeliveries,
  filterRuns,
  idsInFilteredSelection,
  type DeliveryFilterRow,
  type RunFilterRow,
} from "../src/ui/filters.js";
import { embeddedLogic } from "../src/ui/embed.js";

function delivery(partial: Partial<DeliveryFilterRow> & Pick<DeliveryFilterRow, "id">): DeliveryFilterRow {
  return {
    event: "push",
    action: null,
    status: "failed",
    statusCode: 503,
    reason: "http_error",
    scope: "repo",
    owner: "northwind",
    repo: "web",
    targetUrl: "https://web.northwind.dev/hooks/github",
    guid: "guid-" + partial.id,
    ...partial,
  };
}

function run(partial: Partial<RunFilterRow> & Pick<RunFilterRow, "id">): RunFilterRow {
  return {
    name: "CI",
    displayTitle: "Fix tax rounding",
    status: "queued",
    event: "push",
    headBranch: "main",
    owner: "northwind",
    repo: "web",
    reason: "queued",
    ...partial,
  };
}

const deliveries = [
  delivery({ id: 501, repo: "checkout-api", event: "push", statusCode: 503 }),
  delivery({ id: 503, repo: "web", event: "workflow_job", reason: "missing_response", statusCode: 0, action: "queued" }),
  delivery({ id: 507, scope: "org", owner: undefined, repo: undefined, org: "northwind", event: "team", statusCode: 504 }),
  delivery({ id: 508, scope: "app", owner: undefined, repo: undefined, event: "push", statusCode: 503, targetUrl: undefined }),
];

const runs = [
  run({ id: 1001, repo: "checkout-api", status: "queued", event: "push", name: "CI" }),
  run({ id: 1002, repo: "billing", status: "queued", event: "release", name: "Release", displayTitle: "v2.4.1" }),
  run({ id: 1003, repo: "web", status: "waiting", event: "pull_request", name: "Deploy preview", headBranch: "feature/checkout-copy" }),
];

describe("list filters", () => {
  it("returns every row when the query is empty and does not reorder them", () => {
    expect(filterDeliveries(deliveries, null).map((item) => item.id)).toEqual([501, 503, 507, 508]);
    expect(filterRuns(runs, { query: "  ", repository: "", event: "", status: "" }).map((item) => item.id)).toEqual([
      1001, 1002, 1003,
    ]);
    expect(deliveries.map((item) => item.id)).toEqual([501, 503, 507, 508]);
  });

  it("filters deliveries by repository, event, and status together", () => {
    expect(deliveryPlace(deliveries[0]!)).toBe("northwind/checkout-api");
    expect(deliveryPlace(deliveries[2]!)).toBe("northwind org hook");
    expect(deliveryPlace(deliveries[3]!)).toBe("GitHub App");
    expect(deliveryResult(deliveries[1]!)).toBe("no response");
    expect(deliveryResult(deliveries[0]!)).toBe("503");

    const visible = filterDeliveries(deliveries, {
      repository: "northwind/web",
      event: "workflow_job",
      status: "no response",
    });
    expect(visible.map((item) => item.id)).toEqual([503]);
    expect(filterDeliveries(deliveries, { repository: "northwind/web", status: "503" })).toEqual([]);
  });

  it("searches deliveries without case sensitivity", () => {
    const visible = filterDeliveries(deliveries, { query: "  TEAM  " });
    expect(visible.map((item) => item.id)).toEqual([507]);
    expect(filterDeliveries(deliveries, { query: "github app" }).map((item) => item.id)).toEqual([508]);
    expect(filterDeliveries(deliveries, { query: "504" }).map((item) => item.id)).toEqual([507]);
  });

  it("filters runs by repository, event, and status, and searches the workflow", () => {
    expect(filterRuns(runs, { repository: "northwind/billing", event: "release", status: "queued" }).map((item) => item.id)).toEqual([
      1002,
    ]);
    expect(filterRuns(runs, { status: "waiting" }).map((item) => item.id)).toEqual([1003]);
    expect(filterRuns(runs, { query: "preview" }).map((item) => item.id)).toEqual([1003]);
    expect(filterRuns(runs, { query: "checkout-copy" }).map((item) => item.id)).toEqual([1003]);
  });

  it("builds sorted choices from the full list", () => {
    expect(deliveryChoices(deliveries)).toEqual({
      repositories: ["GitHub App", "northwind org hook", "northwind/checkout-api", "northwind/web"],
      events: ["push", "team", "workflow_job"],
      statuses: ["503", "504", "no response"],
    });
  });

  it("keeps bulk actions on the checked rows that are still visible", () => {
    const visible = filterDeliveries(deliveries, { repository: "northwind/web" });
    const selected = new Set([501, 503, 508]);
    expect(idsInFilteredSelection(deliveries, visible, selected)).toEqual([503]);
    expect(idsInFilteredSelection(runs, filterRuns(runs, { status: "queued" }), new Set([1002, 1003]))).toEqual([1002]);
    expect(idsInFilteredSelection(deliveries, visible, new Set([501]))).toEqual([]);
  });

  it("runs the same bulk rule from the script embedded in the page", () => {
    const sandbox: { ids: number[] } = { ids: [] };
    vm.createContext(sandbox);
    vm.runInContext(
      `${embeddedLogic}
      var items = ${JSON.stringify(deliveries)};
      var visible = filterDeliveries(items, { repository: "northwind/web" });
      ids = idsInFilteredSelection(items, visible, new Set([501, 503, 508]));
      `,
      sandbox,
    );
    expect(sandbox.ids).toEqual([503]);
  });
});
