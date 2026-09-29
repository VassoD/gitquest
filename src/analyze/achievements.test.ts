import { describe, expect, it } from "vitest";
import { makeCommit } from "../test-helpers.js";
import { evaluateAchievements, THRESHOLDS } from "./achievements.js";
import { detectFirsts } from "./firsts.js";
import { computeStats } from "./stats.js";
import type { Achievement } from "./types.js";

function achievementsFor(commits: ReturnType<typeof makeCommit>[]): Map<string, Achievement> {
  const stats = computeStats(commits);
  return new Map(evaluateAchievements(commits, stats, detectFirsts(commits)).map((achievement) => [achievement.id, achievement]));
}

describe("evaluateAchievements", () => {
  it("should unlock First Blood on the date the first test file was created", () => {
    const achievements = achievementsFor([
      makeCommit("2020-01-01", {}, [{ path: "src/a.ts" }]),
      makeCommit("2021-03-02", { createdPaths: ["src/a.test.ts"] }, [{ path: "src/a.test.ts" }]),
    ]);
    const firstBlood = achievements.get("first-blood");
    expect(firstBlood?.unlocked).toBe(true);
    expect(firstBlood?.unlockedAt?.toISOString().slice(0, 10)).toBe("2021-03-02");
  });

  it("should keep an achievement locked with partial progress", () => {
    const commits = Array.from({ length: 250 }, (_, index) => makeCommit(`2022-01-${String((index % 28) + 1).padStart(2, "0")}`));
    const centurion = achievementsFor(commits).get("centurion");
    expect(centurion?.unlocked).toBe(false);
    expect(centurion?.progress).toBe(Math.round((250 / THRESHOLDS.centurionCommits) * 100));
    expect(centurion?.unlockedAt).toBeNull();
  });

  it("should date Code Janitor at the commit that crossed the threshold", () => {
    const achievements = achievementsFor([
      makeCommit("2023-01-01", {}, [{ path: "a.ts", deleted: THRESHOLDS.janitorDeletedLines - 1 }]),
      makeCommit("2023-06-01", {}, [{ path: "b.ts", deleted: 5 }]),
    ]);
    expect(achievements.get("code-janitor")?.unlockedAt?.toISOString().slice(0, 10)).toBe("2023-06-01");
  });

  it("should list unlocked achievements before locked ones", () => {
    const list = [...achievementsFor([makeCommit("2020-01-01", { createdPaths: ["Dockerfile"] }, [{ path: "Dockerfile" }])]).values()];
    const firstLocked = list.findIndex((achievement) => !achievement.unlocked);
    expect(list.slice(firstLocked).every((achievement) => !achievement.unlocked)).toBe(true);
  });
});

describe("Polyglot", () => {
  it("should unlock on the commit that brought in the fifth language", () => {
    const languages = ["a.ts", "b.py", "c.go", "d.rs", "e.rb"];
    const commits = languages.map((path, index) => makeCommit(`2024-0${index + 1}-10`, {}, [{ path, added: 300 }]));
    expect(achievementsFor(commits).get("polyglot")?.unlockedAt?.toISOString().slice(0, 10)).toBe("2024-05-10");
  });
});
