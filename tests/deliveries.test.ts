import { describe, expect, it } from "vitest";
import { classifyDelivery, isFailedOrMissingDelivery } from "../src/core/deliveries.js";

describe("failed or missing deliveries", () => {
  it("ignores successful responses", () => {
    expect(isFailedOrMissingDelivery({ status: "OK", statusCode: 200 })).toBe(false);
    expect(isFailedOrMissingDelivery({ status: "ok", statusCode: 204 })).toBe(false);
    expect(isFailedOrMissingDelivery({ status: "", statusCode: 201 })).toBe(false);
    expect(classifyDelivery({ status: "success", statusCode: 200 }).failed).toBe(false);
  });

  it("flags HTTP errors, unanswered deliveries, and non-OK statuses", () => {
    expect(classifyDelivery({ status: "failed", statusCode: 503 })).toEqual({
      failed: true,
      reason: "http_error",
    });
    expect(classifyDelivery({ status: "failed", statusCode: 404 })).toEqual({
      failed: true,
      reason: "http_error",
    });
    expect(classifyDelivery({ status: "failed", statusCode: 0 })).toEqual({
      failed: true,
      reason: "missing_response",
    });
    expect(classifyDelivery({ status: "", statusCode: null })).toEqual({
      failed: true,
      reason: "missing_response",
    });
    expect(classifyDelivery({ status: "timed_out", statusCode: 200 })).toEqual({
      failed: true,
      reason: "failed_status",
    });
  });
});
