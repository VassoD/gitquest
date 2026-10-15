import type { Achievement, Level, Stats } from "./types.js";

const XP_PER_COMMIT = 10;
const LINES_PER_XP = 50;
const XP_PER_ACHIEVEMENT = 250;
/** Level n needs XP_CURVE * n^2 total XP, so each level takes a bit longer than the last. */
const XP_CURVE = 50;

export function xpForLevel(level: number): number {
  return XP_CURVE * level * level;
}

export function computeLevel(stats: Stats, achievements: Achievement[]): Level {
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const xp =
    stats.totalCommits * XP_PER_COMMIT +
    Math.round((stats.added + stats.deleted) / LINES_PER_XP) +
    unlockedCount * XP_PER_ACHIEVEMENT;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / XP_CURVE)));
  return { level, xp, currentLevelXp: xpForLevel(level), nextLevelXp: xpForLevel(level + 1) };
}

const CLASS_SHARE_THRESHOLD = 0.25;
const DOMINANT_SHARE_THRESHOLD = 0.6;
/** Share of frontend lines that are stylesheets for a frontend player to count as a styling specialist. */
const STYLE_SHARE_THRESHOLD = 0.4;

export function computeClassName(stats: Stats): string {
  const lines = stats.disciplineLines;
  const total = Object.values(lines).reduce((sum, count) => sum + count, 0);
  if (!total) return "Code Adventurer";
  const linesOf = (discipline: string): number => lines[discipline] ?? 0;
  const share = (discipline: string): number => linesOf(discipline) / total;
  const frontendLines = linesOf("frontend") + linesOf("style");
  const frontendShare = frontendLines / total;

  if (share("infra") >= CLASS_SHARE_THRESHOLD) return "DevOps Warlock";
  if (share("data") >= CLASS_SHARE_THRESHOLD) return "Data Alchemist";
  if (share("mobile") >= CLASS_SHARE_THRESHOLD) return "Mobile Ranger";
  if (share("test") >= CLASS_SHARE_THRESHOLD) return "Test Paladin";
  if (share("docs") >= CLASS_SHARE_THRESHOLD) return "Lore Keeper";
  if (frontendShare >= DOMINANT_SHARE_THRESHOLD) {
    return linesOf("style") / frontendLines >= STYLE_SHARE_THRESHOLD ? "Pixel Painter" : "Frontend Illusionist";
  }
  if (share("backend") >= DOMINANT_SHARE_THRESHOLD) return "Backend Blacksmith";
  if (frontendShare >= CLASS_SHARE_THRESHOLD && share("backend") >= CLASS_SHARE_THRESHOLD) return "Full-Stack Artificer";
  return "Code Adventurer";
}
