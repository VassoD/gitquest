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

  it("should count TypeScript under a server folder as backend", () => {
    const stats = computeStats([makeCommit("2022-01-01", {}, [{ path: "web/app.tsx", added: 500 }, { path: "apps/api/users.ts", added: 400 }])]);
    expect(computeClassName(stats)).toBe("Full-Stack Artificer");
  });

  it.each([
    ["Mobile Ranger", "ios/App/AppDelegate.swift"],
    ["Test Paladin", "src/user.test.ts"],
    ["Lore Keeper", "docs/guide.md"],
  ])("should name a player with a large share of %s files", (className, path) => {
    const stats = computeStats([makeCommit("2022-01-01", {}, [{ path, added: 300 }, { path: "a.tsx", added: 500 }])]);
    expect(computeClassName(stats)).toBe(className);
  });

  it("should call a frontend player who mostly writes stylesheets a pixel painter", () => {
    const stats = computeStats([makeCommit("2022-01-01", {}, [{ path: "a.scss", added: 500 }, { path: "a.tsx", added: 500 }])]);
    expect(computeClassName(stats)).toBe("Pixel Painter");
  });

  it("should keep the frontend class when stylesheets are a small part", () => {
    const stats = computeStats([makeCommit("2022-01-01", {}, [{ path: "a.css", added: 100 }, { path: "a.tsx", added: 900 }])]);
    expect(computeClassName(stats)).toBe("Frontend Illusionist");
  });

  it("should fall back when there is no code", () => {
    expect(computeClassName(computeStats([]))).toBe("Code Adventurer");
  });
});
