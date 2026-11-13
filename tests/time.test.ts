import { describe, expect, it } from "vitest";
import { createdQualifier, isWithinWindow, parseUserTime, parseWindow, splitDeliveryPage } from "../src/core/time.js";
import type { RawDelivery } from "../src/core/types.js";

const window = {
  from: "2026-11-09T14:00:00.000Z",
  to: "2026-11-09T18:30:00.000Z",
};

function row(id: number, deliveredAt: string | null): RawDelivery {
  return {
    id,
    guid: String(id),
    deliveredAt,
    status: "failed",
    statusCode: 503,
    event: "push",
    action: null,
    redelivery: false,
    duration: 1,
    hookId: 1,
    scope: "repo",
    owner: "acme",
    repo: "web",
  };
}

describe("time window", () => {
  it("treats datetime-local values as UTC and keeps inclusive bounds", () => {
    expect(parseUserTime("2026-11-09T14:00")).toBe("2026-11-09T14:00:00.000Z");
    expect(parseUserTime("2026-11-09T16:00:00+02:00")).toBe("2026-11-09T14:00:00.000Z");
    const parsed = parseWindow("2026-11-09T14:00", "2026-11-09T18:30");
    expect(isWithinWindow(parsed.from, parsed)).toBe(true);
    expect(isWithinWindow(parsed.to, parsed)).toBe(true);
    expect(isWithinWindow("2026-11-09T13:59:59.999Z", parsed)).toBe(false);
    expect(isWithinWindow("2026-11-09T18:30:00.001Z", parsed)).toBe(false);
    expect(isWithinWindow(null, parsed)).toBe(false);
  });

  it("rejects an inverted window", () => {
    expect(() => parseWindow("2026-11-09T18:30", "2026-11-09T14:00")).toThrow(/before/);
  });

  it("stops paging when a newest-first page crosses the window start", () => {
    const split = splitDeliveryPage(
      [row(1, "2026-11-09T19:00:00.000Z"), row(2, "2026-11-09T15:00:00.000Z"), row(3, null), row(4, "2026-11-09T13:00:00.000Z")],
      window,
    );
    expect(split.stop).toBe(true);
    expect(split.keep.map((delivery) => delivery.id)).toEqual([2, 3]);
  });

  it("keeps paging when every row is still newer than the window", () => {
    const split = splitDeliveryPage([row(1, "2026-11-09T19:00:00.000Z")], window);
    expect(split.stop).toBe(false);
    expect(split.keep).toHaveLength(0);
  });

  it("builds a date qualifier that includes the day before the window", () => {
    expect(createdQualifier(window)).toBe("2026-11-08..2026-11-09");
  });
});
