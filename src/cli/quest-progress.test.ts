import { describe, expect, it } from "vitest";
import { HERO_FRAMES, questLine, xpBar } from "./quest-progress.js";

describe("xpBar", () => {
  it("should fill the bar in proportion to the work done", () => {
    expect(xpBar(5, 10, 8)).toEqual({ filled: "████", empty: "░░░░" });
  });

  it("should stay empty when there is nothing to do", () => {
    expect(xpBar(0, 0, 4)).toEqual({ filled: "", empty: "░░░░" });
  });

  it("should never overflow when more items finish than expected", () => {
    expect(xpBar(12, 10, 4)).toEqual({ filled: "████", empty: "" });
  });
});

describe("HERO_FRAMES", () => {
  it("should keep every frame the same width so the line does not jitter", () => {
    expect(new Set(HERO_FRAMES.map((frame) => frame.length)).size).toBe(1);
  });
});

describe("questLine", () => {
  const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

  it("should show label, bar, count and quip when there is room", () => {
    expect(plain(questLine("Syncing repos", "grinding XP", 4, 8, 80))).toBe("Syncing repos ████████░░░░░░░░ 4/8 · grinding XP");
  });

  it("should drop the quip before shortening the label", () => {
    expect(plain(questLine("Syncing repos", "grinding XP", 4, 8, 40))).toBe("Syncing repos ████████░░░░░░░░ 4/8");
  });

  it("should shorten the label when even the bar barely fits", () => {
    expect(plain(questLine("Fetching the files your commits touched", "grinding XP", 4, 8, 30))).toBe("Fetching… ████████░░░░░░░░ 4/8");
  });

  it("should keep only the count when the bar does not fit", () => {
    expect(plain(questLine("Syncing repos", "grinding XP", 126, 130, 21))).toBe("Syncing repos 126/130");
  });

  it("should never be wider than the room it is given", () => {
    for (const width of [12, 25, 33, 50, 90]) {
      expect(plain(questLine("Fetching the files your commits touched", "befriending the commit goblins", 126, 130, width)).length).toBeLessThanOrEqual(width);
    }
  });
});
