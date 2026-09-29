import { describe, expect, it } from "vitest";
import { makeCommit } from "../test-helpers.js";
import { computeClassName, computeLevel, xpForLevel } from "./level.js";
import { computeStats } from "./stats.js";

describe("computeLevel", () => {
  it("should start everyone at level 1", () => {
    expect(computeLevel(computeStats([]), []).level).toBe(1);
  });

  it("should keep xp between the current and next level thresholds", () => {
    const commits = Array.from({ length: 400 }, () => makeCommit("2022-02-02", {}, [{ added: 100, deleted: 20 }]));
    const level = computeLevel(computeStats(commits), []);
    expect(level.xp).toBeGreaterThanOrEqual(xpForLevel(level.level));
    expect(level.xp).toBeLessThan(xpForLevel(level.level + 1));
  });
});

describe("computeClassName", () => {
  it("should call a balanced frontend and backend mix full-stack", () => {
    const stats = computeStats([makeCommit("2022-01-01", {}, [{ path: "a.tsx", added: 500 }, { path: "b.go", added: 400 }])]);
    expect(computeClassName(stats)).toBe("Full-Stack Artificer");
  });

  it("should fall back when there is no code", () => {
    expect(computeClassName(computeStats([]))).toBe("Code Adventurer");
  });
});
