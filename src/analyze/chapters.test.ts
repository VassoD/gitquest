import { describe, expect, it } from "vitest";
import { makeCommit } from "../test-helpers.js";
import { buildChapters } from "./chapters.js";
import { computeStats } from "./stats.js";

const NOW = new Date("2026-09-29T00:00:00Z");

describe("buildChapters", () => {
  it("should never give two chapters the same title", () => {
    const commits = [2020, 2021, 2022, 2023, 2024].flatMap((year) =>
      Array.from({ length: year === 2024 ? 5 : 2 }, () => makeCommit(`${year}-06-01`, {}, [{ path: "a.ts", added: 10 }])));
    const titles = buildChapters(computeStats(commits), [], [], NOW).map((chapter) => chapter.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("should show every new language even when there are many", () => {
    const commits = [
      makeCommit("2025-01-01", {}, [{ path: "a.ts", added: 900 }, { path: "b.js", added: 800 }, { path: "c.py", added: 700 }]),
      makeCommit("2026-01-01", {}, ["a.ts", "b.js", "c.py", "d.dart", "e.go", "f.cpp", "g.sql"].map((path) => ({ path, added: 300 }))),
    ];
    const [, latest] = buildChapters(computeStats(commits), [], [], NOW);
    expect(latest?.skills).toEqual(expect.arrayContaining(["Dart", "Go", "C++", "SQL"]));
    expect(latest?.skills.length).toBeLessThanOrEqual(5);
  });
});
