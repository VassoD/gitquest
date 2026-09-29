export type Rarity = "common" | "rare" | "epic" | "legendary";

export type IconName =
  | "sword" | "box" | "broom" | "crown" | "scroll" | "moon" | "gear"
  | "gem" | "flame" | "star" | "shield" | "quill" | "sun";

export interface First {
  key: string;
  label: string;
  date: Date;
  repo: string;
  path: string;
}

export interface Streak {
  days: number;
  start: string | null;
  end: string | null;
}

export interface BiggestCommit {
  files: number;
  repo: string;
  subject: string;
  date: Date;
}

export interface YearStats {
  year: number;
  commits: number;
  added: number;
  deleted: number;
  repos: string[];
  topRepo: string | null;
  languages: string[];
  newLanguages: string[];
  conventionalShare: number;
  /** Commit count per week, index 0 to 52. */
  weeks: number[];
}

export interface Stats {
  totalCommits: number;
  repos: string[];
  added: number;
  deleted: number;
  languages: string[];
  firstCommitAt: Date | null;
  lastCommitAt: Date | null;
  longestStreak: Streak;
  nightOwlCommits: number;
  weekendCommits: number;
  conventionalCommits: number;
  biggestCommit: BiggestCommit | null;
  disciplineLines: Record<string, number>;
  years: YearStats[];
}

export type AchievementKind = "first" | "milestone";

export interface Achievement {
  id: string;
  kind: AchievementKind;
  name: string;
  description: string;
  icon: IconName;
  rarity: Rarity;
  unlocked: boolean;
  unlockedAt: Date | null;
  /** 0 to 100, how close a locked achievement is. */
  progress: number;
}

export interface Level {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
}

export interface Chapter {
  year: number;
  title: string;
  story: string;
  skills: string[];
  newSkills: string[];
}

export interface Profile {
  player: string;
  className: string;
  generatedAt: Date;
  stats: Stats;
  level: Level;
  firsts: First[];
  achievements: Achievement[];
  chapters: Chapter[];
}
