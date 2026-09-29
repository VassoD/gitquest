import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./map-with-concurrency.js";

describe("mapWithConcurrency", () => {
  it("should keep input order even when later items finish first", async () => {
    const result = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms * 2;
    });
    expect(result).toEqual([60, 20, 40]);
  });

  it("should never run more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, index) => index), 3, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    });
    expect(peak).toBe(3);
  });

  it("should report progress for every item", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3], 2, async (item) => item, (done) => seen.push(done));
    expect(seen).toEqual([1, 2, 3]);
  });
});
