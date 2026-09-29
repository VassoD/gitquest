import type { Commit } from "../scan/types.js";
import { isNoisePath, isProgrammingLanguage, languageOf } from "./languages.js";
import type { BiggestCommit, Stats, Streak, YearStats } from "./types.js";

const NIGHT_OWL_END_HOUR = 5;
const WEEKS_PER_YEAR = 53;
const MS_PER_DAY = 86_400_000;
/** A language counts once you have written this many lines of it. Filters out one-off config tweaks. */
export const LANGUAGE_MIN_LINES = 200;
const CONVENTIONAL_COMMIT = /^(feat|fix|chore|docs|refactor|test|perf|build|ci|style|revert)(\(.+\))?!?:/;

export function isConventional(subject: string): boolean {
  return CONVENTIONAL_COMMIT.test(subject);
}

function weekOfYear(localDate: string): number {
  const date = new Date(`${localDate}T00:00:00Z`);
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.min(WEEKS_PER_YEAR - 1, Math.floor((date.getTime() - startOfYear) / MS_PER_DAY / 7));
}

export function longestStreak(localDates: string[]): Streak {
  const days = [...new Set(localDates)].sort();
  let best: Streak = { days: 0, start: null, end: null };
  let runStart = 0;
  for (let index = 0; index < days.length; index++) {
    const previous = days[index - 1];
    const current = days[index] as string;
    const isConsecutive = previous !== undefined && Date.parse(current) - Date.parse(previous) === MS_PER_DAY;
    if (!isConsecutive) runStart = index;
    const length = index - runStart + 1;
    if (length > best.days) best = { days: length, start: days[runStart] ?? null, end: current };
  }
  return best;
}

function meaningfulFiles(commit: Commit): Commit["files"] {
  return commit.files.filter((file) => !isNoisePath(file.path));
}

interface YearAccumulator {
  commits: number;
  added: number;
  deleted: number;
  conventional: number;
  repoCommits: Map<string, number>;
  languageLines: Map<string, number>;
  weeks: number[];
}

function emptyYear(): YearAccumulator {
  return { commits: 0, added: 0, deleted: 0, conventional: 0, repoCommits: new Map(), languageLines: new Map(), weeks: Array<number>(WEEKS_PER_YEAR).fill(0) };
}

function increment<K>(map: Map<K, number>, key: K, by: number): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Commits must be sorted oldest first. */
export function computeStats(commits: Commit[]): Stats {
  const yearly = new Map<number, YearAccumulator>();
  const languageLines = new Map<string, number>();
  const disciplineLines: Record<string, number> = {};
  let added = 0;
  let deleted = 0;
  let nightOwlCommits = 0;
  let weekendCommits = 0;
  let conventionalCommits = 0;
  let biggestCommit: BiggestCommit | null = null;

  for (const commit of commits) {
    const year = Number(commit.localDate.slice(0, 4));
    const bucket = yearly.get(year) ?? emptyYear();
    yearly.set(year, bucket);

    const files = meaningfulFiles(commit);
    const commitAdded = files.reduce((sum, file) => sum + file.added, 0);
    const commitDeleted = files.reduce((sum, file) => sum + file.deleted, 0);
    added += commitAdded;
    deleted += commitDeleted;
    bucket.commits += 1;
    bucket.added += commitAdded;
    bucket.deleted += commitDeleted;
    bucket.weeks[weekOfYear(commit.localDate)] = (bucket.weeks[weekOfYear(commit.localDate)] ?? 0) + 1;
    increment(bucket.repoCommits, commit.repo, 1);

    if (commit.localHour < NIGHT_OWL_END_HOUR) nightOwlCommits += 1;
    if (commit.localWeekday === 0 || commit.localWeekday === 6) weekendCommits += 1;
    if (isConventional(commit.subject)) {
      conventionalCommits += 1;
      bucket.conventional += 1;
    }
    if (!biggestCommit || files.length > biggestCommit.files) {
      biggestCommit = { files: files.length, repo: commit.repo, subject: commit.subject, date: commit.authoredAt };
    }

    for (const file of files) {
      const language = languageOf(file.path);
      if (!language) continue;
      increment(languageLines, language.name, file.added);
      increment(bucket.languageLines, language.name, file.added);
      disciplineLines[language.discipline] = (disciplineLines[language.discipline] ?? 0) + file.added;
    }
  }

  const knownLanguages = (lines: Map<string, number>): string[] =>
    [...lines.entries()]
      .filter(([name, count]) => count >= LANGUAGE_MIN_LINES && isProgrammingLanguage(name))
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

  const seenLanguages = new Set<string>();
  const years: YearStats[] = [...yearly.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, bucket]) => {
      const languages = knownLanguages(bucket.languageLines);
      const newLanguages = languages.filter((language) => !seenLanguages.has(language));
      newLanguages.forEach((language) => seenLanguages.add(language));
      const topRepo = [...bucket.repoCommits.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        year,
        commits: bucket.commits,
        added: bucket.added,
        deleted: bucket.deleted,
        repos: [...bucket.repoCommits.keys()],
        topRepo,
        languages,
        newLanguages,
        conventionalShare: bucket.commits ? bucket.conventional / bucket.commits : 0,
        weeks: bucket.weeks,
      };
    });

  return {
    totalCommits: commits.length,
    repos: [...new Set(commits.map((commit) => commit.repo))],
    added,
    deleted,
    languages: knownLanguages(languageLines),
    firstCommitAt: commits[0]?.authoredAt ?? null,
    lastCommitAt: commits.at(-1)?.authoredAt ?? null,
    longestStreak: longestStreak(commits.map((commit) => commit.localDate)),
    nightOwlCommits,
    weekendCommits,
    conventionalCommits,
    biggestCommit,
    disciplineLines,
    years,
  };
}
