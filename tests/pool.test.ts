import { describe, expect, it } from "vitest";
import { mapPool } from "../src/core/pool.js";

describe("mapPool", () => {
  it("preserves order and caps concurrency", async () => {
    let active = 0;
    let max = 0;
    const values = await mapPool([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return item * 2;
    });
    expect(values).toEqual([2, 4, 6, 8, 10]);
    expect(max).toBe(2);
  });
});
