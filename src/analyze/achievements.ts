import type { Commit } from "../scan/types.js";
import { isNoisePath, isProgrammingLanguage, languageOf } from "./languages.js";
import { isConventional, LANGUAGE_MIN_LINES } from "./stats.js";
import type { Achievement, AchievementKind, First, IconName, Rarity, Stats } from "./types.js";

export const THRESHOLDS = {
  janitorDeletedLines: 10_000,
  refactorFiles: 100,
  polyglotLanguages: 5,
  nightOwlCommits: 100,
  weekendCommits: 100,
  streakDays: 30,
  centurionCommits: 1_000,
  veteranYears: 5,
  conventionalCommits: 100,
} as const;

interface Definition {
  id: string;
  kind: AchievementKind;
  name: string;
  description: string;
  icon: IconName;
  rarity: Rarity;
  evaluate: (context: EvaluationContext) => { current: number; target: number; unlockedAt: Date | null };
}

interface EvaluationContext {
  commits: Commit[];
  stats: Stats;
  firsts: Map<string, First>;
}

/** Walks commits oldest first and returns the date a running total first reaches the target. */
function dateReached(commits: Commit[], target: number, valueOf: (commit: Commit) => number): Date | null {
  let total = 0;
  for (const commit of commits) {
    total += valueOf(commit);
    if (total >= target) return commit.authoredAt;
  }
  return null;
}

function dateLanguageCountReached(commits: Commit[], target: number): Date | null {
  const linesByLanguage = new Map<string, number>();
  const known = new Set<string>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const language = languageOf(file.path);
      if (!language || !isProgrammingLanguage(language.name) || isNoisePath(file.path)) continue;
      const lines = (linesByLanguage.get(language.name) ?? 0) + file.added;
      linesByLanguage.set(language.name, lines);
      if (lines >= LANGUAGE_MIN_LINES) known.add(language.name);
    }
    if (known.size >= target) return commit.authoredAt;
  }
  return null;
}

function fromFirst(key: string): Definition["evaluate"] {
  return ({ firsts }) => {
    const first = firsts.get(key);
    return { current: first ? 1 : 0, target: 1, unlockedAt: first?.date ?? null };
  };
}

function fromCount(target: number, valueOf: (commit: Commit) => number, current: (stats: Stats) => number): Definition["evaluate"] {
  return ({ commits, stats }) => ({ current: current(stats), target, unlockedAt: dateReached(commits, target, valueOf) });
}

const deletedLines = (commit: Commit): number =>
  commit.files.filter((file) => !isNoisePath(file.path)).reduce((sum, file) => sum + file.deleted, 0);

const DEFINITIONS: Definition[] = [
  { id: "first-blood", kind: "first", name: "First Blood", description: "Wrote your first test", icon: "sword", rarity: "rare", evaluate: fromFirst("test") },
  { id: "works-on-my-machine", kind: "first", name: "Works On My Machine", description: "Shipped your first Dockerfile", icon: "box", rarity: "rare", evaluate: fromFirst("docker") },
  { id: "pipeline-architect", kind: "first", name: "Pipeline Architect", description: "Set up your first CI pipeline", icon: "gear", rarity: "rare", evaluate: fromFirst("ci") },
  { id: "schema-whisperer", kind: "first", name: "Schema Whisperer", description: "Wrote your first database migration", icon: "gem", rarity: "common", evaluate: fromFirst("migration") },
  { id: "type-safe", kind: "first", name: "Type Safe", description: "Wrote your first TypeScript file", icon: "shield", rarity: "common", evaluate: fromFirst("typescript") },
  {
    id: "code-janitor", kind: "milestone", name: "Code Janitor", description: `Deleted ${THRESHOLDS.janitorDeletedLines.toLocaleString("en-US")} lines. Less is more.`, icon: "broom", rarity: "epic",
    evaluate: fromCount(THRESHOLDS.janitorDeletedLines, deletedLines, (stats) => stats.deleted),
  },
  {
    id: "refactor-boss", kind: "milestone", name: "Refactor Boss", description: `Touched ${THRESHOLDS.refactorFiles}+ files in a single commit`, icon: "crown", rarity: "legendary",
    evaluate: ({ stats }) => ({
      current: stats.biggestCommit?.files ?? 0,
      target: THRESHOLDS.refactorFiles,
      unlockedAt: (stats.biggestCommit?.files ?? 0) >= THRESHOLDS.refactorFiles ? (stats.biggestCommit?.date ?? null) : null,
    }),
  },
  {
    id: "polyglot", kind: "milestone", name: "Polyglot", description: `Wrote real code in ${THRESHOLDS.polyglotLanguages} languages`, icon: "scroll", rarity: "epic",
    evaluate: ({ commits, stats }) => ({
      current: stats.languages.length,
      target: THRESHOLDS.polyglotLanguages,
      unlockedAt: dateLanguageCountReached(commits, THRESHOLDS.polyglotLanguages),
    }),
  },
  {
    id: "night-owl", kind: "milestone", name: "Night Owl", description: `${THRESHOLDS.nightOwlCommits} commits between midnight and 5am`, icon: "moon", rarity: "common",
    evaluate: fromCount(THRESHOLDS.nightOwlCommits, (commit) => (commit.localHour < 5 ? 1 : 0), (stats) => stats.nightOwlCommits),
  },
  {
    id: "weekend-warrior", kind: "milestone", name: "Weekend Warrior", description: `${THRESHOLDS.weekendCommits} commits on a Saturday or Sunday`, icon: "sun", rarity: "common",
    evaluate: fromCount(THRESHOLDS.weekendCommits, (commit) => (commit.localWeekday % 6 === 0 ? 1 : 0), (stats) => stats.weekendCommits),
  },
  {
    id: "unbroken", kind: "milestone", name: "Unbroken", description: `Committed ${THRESHOLDS.streakDays} days in a row`, icon: "flame", rarity: "epic",
    evaluate: ({ stats }) => ({
      current: stats.longestStreak.days,
      target: THRESHOLDS.streakDays,
      unlockedAt: stats.longestStreak.days >= THRESHOLDS.streakDays && stats.longestStreak.end ? new Date(stats.longestStreak.end) : null,
    }),
  },
  {
    id: "centurion", kind: "milestone", name: "Centurion", description: `Reached ${THRESHOLDS.centurionCommits.toLocaleString("en-US")} commits`, icon: "star", rarity: "rare",
    evaluate: fromCount(THRESHOLDS.centurionCommits, () => 1, (stats) => stats.totalCommits),
  },
  {
    id: "clear-messenger", kind: "milestone", name: "Clear Messenger", description: `${THRESHOLDS.conventionalCommits} conventional commit messages`, icon: "quill", rarity: "rare",
    evaluate: fromCount(THRESHOLDS.conventionalCommits, (commit) => (isConventional(commit.subject) ? 1 : 0), (stats) => stats.conventionalCommits),
  },
  {
    id: "veteran", kind: "milestone", name: "Veteran", description: `Committed code in ${THRESHOLDS.veteranYears} different years`, icon: "shield", rarity: "epic",
    evaluate: ({ commits, stats }) => {
      const reachedYear = stats.years[THRESHOLDS.veteranYears - 1]?.year;
      const firstCommitThatYear = commits.find((commit) => commit.localDate.startsWith(`${reachedYear}-`));
      return { current: stats.years.length, target: THRESHOLDS.veteranYears, unlockedAt: firstCommitThatYear?.authoredAt ?? null };
    },
  },
];

const MAX_PROGRESS = 100;

export function evaluateAchievements(commits: Commit[], stats: Stats, firsts: First[]): Achievement[] {
  const context: EvaluationContext = { commits, stats, firsts: new Map(firsts.map((first) => [first.key, first])) };
  return DEFINITIONS.map(({ evaluate, ...definition }) => {
    const { current, target, unlockedAt } = evaluate(context);
    const unlocked = current >= target;
    return {
      ...definition,
      unlocked,
      unlockedAt: unlocked ? unlockedAt : null,
      progress: Math.min(MAX_PROGRESS, Math.round((current / target) * MAX_PROGRESS)),
    };
  }).sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || (a.unlockedAt?.getTime() ?? 0) - (b.unlockedAt?.getTime() ?? 0));
}
