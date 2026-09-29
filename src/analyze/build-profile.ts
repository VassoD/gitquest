import type { Commit } from "../scan/types.js";
import { evaluateAchievements } from "./achievements.js";
import { buildChapters } from "./chapters.js";
import { detectFirsts } from "./firsts.js";
import { computeClassName, computeLevel } from "./level.js";
import { computeStats } from "./stats.js";
import type { Profile } from "./types.js";

/** Commits must already be filtered to the player and sorted oldest first. */
export function buildProfile(player: string, commits: Commit[], now = new Date()): Profile {
  const stats = computeStats(commits);
  const firsts = detectFirsts(commits);
  const achievements = evaluateAchievements(commits, stats, firsts);
  return {
    player,
    className: computeClassName(stats),
    generatedAt: now,
    stats,
    level: computeLevel(stats, achievements),
    firsts,
    achievements,
    chapters: buildChapters(stats, firsts, achievements, now),
  };
}
