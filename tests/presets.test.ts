import { describe, expect, it } from "vitest";
import { hoursWindow, toUtcDateTimeLocal } from "../src/core/presets.js";

describe("window presets", () => {
  it("formats a UTC datetime-local value", () => {
    expect(toUtcDateTimeLocal(new Date("2026-11-09T14:05:40.000Z"))).toBe("2026-11-09T14:05");
  });

  it("builds last-1h, last-6h, and last-24h windows ending now", () => {
    const now = new Date("2026-11-13T12:30:00.000Z");
    expect(hoursWindow(now, 1)).toEqual({ from: "2026-11-13T11:30", to: "2026-11-13T12:30" });
    expect(hoursWindow(now, 6)).toEqual({ from: "2026-11-13T06:30", to: "2026-11-13T12:30" });
    expect(hoursWindow(now, 24)).toEqual({ from: "2026-11-12T12:30", to: "2026-11-13T12:30" });
  });
});
