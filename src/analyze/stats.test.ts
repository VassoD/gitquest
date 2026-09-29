import { describe, expect, it } from "vitest";
import { makeCommit } from "../test-helpers.js";
import { computeStats, isConventional, longestStreak } from "./stats.js";

describe("longestStreak", () => {
  it("should find the longest run of consecutive days", () => {
    const streak = longestStreak(["2022-01-01", "2022-01-02", "2022-01-05", "2022-01-06", "2022-01-07", "2022-01-07"]);
    expect(streak).toEqual({ days: 3, start: "2022-01-05", end: "2022-01-07" });
  });

  it("should handle month and year boundaries", () => {
    expect(longestStreak(["2021-12-31", "2022-01-01"]).days).toBe(2);
  });

  it("should return zero for no commits", () => {
    expect(longestStreak([])).toEqual({ days: 0, start: null, end: null });
  });
});

describe("isConventional", () => {
  it.each(["feat: x", "fix(auth): x", "refactor!: x", "chore(deps)!: bump"])("should accept %s", (subject) => {
    expect(isConventional(subject)).toBe(true);
  });

  it.each(["fix", "wip", "Feature: x", "update readme"])("should reject %s", (subject) => {
    expect(isConventional(subject)).toBe(false);
  });
});

describe("computeStats", () => {
  it("should ignore lockfiles and vendored code in line counts", () => {
    const stats = computeStats([
      makeCommit("2020-02-12", {}, [
        { path: "src/app.ts", added: 50, deleted: 5 },
        { path: "package-lock.json", added: 9000, deleted: 9000 },
        { path: "node_modules/x/index.js", added: 400 },
      ]),
    ]);
    expect(stats.added).toBe(50);
    expect(stats.deleted).toBe(5);
    expect(stats.biggestCommit?.files).toBe(1);
  });

  it("should only count a language once enough lines were written", () => {
    const stats = computeStats([
      makeCommit("2020-02-12", {}, [{ path: "a.ts", added: 500 }, { path: "b.py", added: 20 }]),
    ]);
    expect(stats.languages).toEqual(["TypeScript"]);
  });

  it("should mark languages as new only in the year they first appear", () => {
    const stats = computeStats([
      makeCommit("2020-05-01", {}, [{ path: "a.ts", added: 500 }]),
      makeCommit("2021-05-01", {}, [{ path: "b.ts", added: 500 }, { path: "c.go", added: 500 }]),
    ]);
    expect(stats.years.map((year) => year.newLanguages)).toEqual([["TypeScript"], ["Go"]]);
  });

  it("should count night owl and weekend commits in local time", () => {
    const stats = computeStats([
      makeCommit("2022-01-08", { localHour: 2 }),
      makeCommit("2022-01-10", { localHour: 14 }),
    ]);
    expect(stats.nightOwlCommits).toBe(1);
    expect(stats.weekendCommits).toBe(1);
  });
});
