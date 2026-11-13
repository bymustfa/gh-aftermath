import { describe, expect, it } from "vitest";
import { stuckReason } from "../src/core/runs.js";

const window = {
  from: "2026-11-09T14:00:00.000Z",
  to: "2026-11-09T18:30:00.000Z",
};

const now = new Date("2026-11-09T18:30:00.000Z");
const options = {
  now,
  queuedThresholdMs: 10 * 60 * 1000,
  inProgressThresholdMs: 60 * 60 * 1000,
};

describe("stuck workflow runs", () => {
  it("includes queued runs created in the window once they have waited long enough", () => {
    expect(
      stuckReason(
        { status: "queued", createdAt: "2026-11-09T15:05:00.000Z", runStartedAt: null },
        window,
        options,
      ),
    ).toBe("queued");
    expect(
      stuckReason(
        { status: "waiting", createdAt: "2026-11-09T16:01:00.000Z", runStartedAt: null },
        window,
        options,
      ),
    ).toBe("queued");
  });

  it("skips fresh queued runs, runs outside the window, and completed runs", () => {
    expect(
      stuckReason(
        { status: "queued", createdAt: "2026-11-09T18:25:00.000Z", runStartedAt: null },
        window,
        options,
      ),
    ).toBeNull();
    expect(
      stuckReason(
        { status: "queued", createdAt: "2026-11-08T09:00:00.000Z", runStartedAt: null },
        window,
        options,
      ),
    ).toBeNull();
    expect(
      stuckReason(
        { status: "completed", createdAt: "2026-11-09T14:20:00.000Z", runStartedAt: "2026-11-09T14:20:10.000Z" },
        window,
        options,
      ),
    ).toBeNull();
  });

  it("includes in-progress runs that started in the window and have run too long", () => {
    expect(
      stuckReason(
        {
          status: "in_progress",
          createdAt: "2026-11-09T14:40:00.000Z",
          runStartedAt: "2026-11-09T14:40:30.000Z",
        },
        window,
        options,
      ),
    ).toBe("in_progress");
    expect(
      stuckReason(
        {
          status: "in_progress",
          createdAt: "2026-11-09T18:20:00.000Z",
          runStartedAt: "2026-11-09T18:20:00.000Z",
        },
        window,
        options,
      ),
    ).toBeNull();
  });

  it("treats the threshold as inclusive", () => {
    expect(
      stuckReason(
        { status: "queued", createdAt: "2026-11-09T18:20:00.000Z", runStartedAt: null },
        window,
        options,
      ),
    ).toBe("queued");
  });
});
