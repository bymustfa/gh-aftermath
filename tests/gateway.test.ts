import { describe, expect, it } from "vitest";
import { createRequestGateway, type GitHubRequest } from "../src/github/gateway.js";

const window = {
  from: "2026-11-09T14:00:00.000Z",
  to: "2026-11-09T18:30:00.000Z",
};

function delivery(id: number, deliveredAt: string) {
  return {
    id,
    guid: `g-${id}`,
    delivered_at: deliveredAt,
    status: "failed",
    status_code: 503,
    event: "push",
    action: null,
    redelivery: false,
    duration: 1,
  };
}

describe("GitHub gateway", () => {
  it("pages deliveries newest-first and stops once the window is passed", async () => {
    const calls: string[] = [];
    const request: GitHubRequest = async (route, params) => {
      calls.push(`${route}?page=${params?.page}`);
      if (params?.page === 1) {
        return {
          status: 200,
          data: [delivery(2, "2026-11-09T19:00:00.000Z"), delivery(1, "2026-11-09T15:00:00.000Z")],
        };
      }
      if (params?.page === 2) {
        return { status: 200, data: [delivery(0, "2026-11-09T12:00:00.000Z")] };
      }
      throw new Error("page 3 should not be requested");
    };
    const gateway = createRequestGateway({ request, perPage: 2, maxPages: 5 });
    const rows = await gateway.listRepoDeliveries("acme", "web", 3, window);
    expect(rows.map((row) => row.id)).toEqual([1]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries");
  });

  it("calls the redeliver, force-cancel, and rerun routes", async () => {
    const calls: { route: string; params: Record<string, unknown> }[] = [];
    const request: GitHubRequest = async (route, params) => {
      calls.push({ route, params: params ?? {} });
      return { status: 202, data: {} };
    };
    const gateway = createRequestGateway({ request, appRequest: request });
    await gateway.redeliver({ scope: "repo", owner: "acme", repo: "web", hookId: 3, deliveryId: 9 });
    await gateway.redeliver({ scope: "org", org: "acme", hookId: 4, deliveryId: 8 });
    await gateway.redeliver({ scope: "app", deliveryId: 7 });
    await gateway.forceCancelRun({ owner: "acme", repo: "web", runId: 5 });
    await gateway.rerun({ owner: "acme", repo: "web", runId: 6 });
    expect(calls.map((call) => call.route)).toEqual([
      "POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts",
      "POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts",
      "POST /app/hook/deliveries/{delivery_id}/attempts",
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel",
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun",
    ]);
  });

  it("falls back to repository workflow runs when the org endpoint is missing", async () => {
    const request: GitHubRequest = async (route, params) => {
      if (route === "GET /orgs/{org}/actions/runs") {
        const error = new Error("Not Found") as Error & { status?: number };
        error.status = 404;
        throw error;
      }
      if (route === "GET /orgs/{org}/repos") {
        return {
          status: 200,
          data: [
            { name: "web", archived: false, owner: { login: "acme" } },
            { name: "old", archived: true, owner: { login: "acme" } },
          ],
        };
      }
      if (route === "GET /repos/{owner}/{repo}/actions/runs") {
        if (params?.status !== "queued") return { status: 200, data: { workflow_runs: [] } };
        return {
          status: 200,
          data: {
            workflow_runs: [
              {
                id: 42,
                name: "CI",
                display_title: "Fix it",
                status: "queued",
                conclusion: null,
                html_url: "https://github.com/acme/web/actions/runs/42",
                created_at: "2026-11-09T15:00:00.000Z",
                updated_at: "2026-11-09T15:00:00.000Z",
                run_started_at: null,
                event: "push",
                head_branch: "main",
                repository: { name: "web", owner: { login: "acme" } },
              },
            ],
          },
        };
      }
      throw new Error(`unexpected ${route}`);
    };
    const gateway = createRequestGateway({ request, perPage: 20 });
    const runs = await gateway.listWorkflowRuns("acme", window);
    expect(runs.map((run) => run.id)).toEqual([42]);
    const repos = await gateway.listRepos("acme");
    expect(repos).toEqual([{ owner: "acme", name: "web" }]);
  });

  it("reads the core rate limit", async () => {
    const request: GitHubRequest = async () => ({
      status: 200,
      data: { resources: { core: { limit: 5000, remaining: 4800, reset: 1_763_000_000 } } },
    });
    const gateway = createRequestGateway({ request });
    await expect(gateway.rateLimit()).resolves.toMatchObject({ limit: 5000, remaining: 4800 });
  });
});
