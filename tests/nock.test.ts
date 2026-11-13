import nock from "nock";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createGitHubGateway } from "../src/github/gateway.js";

const silent = { info: () => undefined, warn: () => undefined };

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

describe("Octokit HTTP", () => {
  it("redelivers a repository webhook and force-cancels a run through api.github.com", async () => {
    nock.disableNetConnect();
    const scope = nock("https://api.github.com")
      .post("/repos/acme/web/hooks/3/deliveries/9/attempts")
      .reply(202, {})
      .post("/repos/acme/web/actions/runs/15/force-cancel")
      .reply(202, {})
      .get("/repos/acme/web/hooks/3/deliveries")
      .query(true)
      .reply(200, [
        {
          id: 9,
          guid: "guid-9",
          delivered_at: "2026-11-09T15:02:00.000Z",
          status: "failed",
          status_code: 503,
          event: "push",
          action: null,
          redelivery: false,
          duration: 4,
        },
      ]);

    const gateway = createGitHubGateway(
      { token: "test-token" },
      { log: silent, perPage: 2, maxPages: 2 },
    );
    await gateway.redeliver({ scope: "repo", owner: "acme", repo: "web", hookId: 3, deliveryId: 9 });
    await gateway.forceCancelRun({ owner: "acme", repo: "web", runId: 15 });
    const deliveries = await gateway.listRepoDeliveries("acme", "web", 3, {
      from: "2026-11-09T14:00:00.000Z",
      to: "2026-11-09T18:30:00.000Z",
    });
    expect(deliveries.map((delivery) => delivery.id)).toEqual([9]);
    expect(deliveries[0]?.statusCode).toBe(503);
    scope.done();
  });
});
