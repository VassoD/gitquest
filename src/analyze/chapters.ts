import type { Achievement, Chapter, First, Stats, YearStats } from "./types.js";

const CLEANUP_RATIO = 1;
const NEW_LANDS_MIN_LANGUAGES = 2;
const PERCENT = 100;

function titleFor(year: YearStats, index: number, stats: Stats, isCurrentYear: boolean): string {
  const busiest = Math.max(...stats.years.map((entry) => entry.commits));
  if (index === 0) return "The Awakening";
  if (isCurrentYear) return "Chapter in Progress";
  if (year.commits === busiest) return "Boss Level";
  if (year.added > 0 && year.deleted / year.added >= CLEANUP_RATIO) return "The Great Cleanup";
  if (year.newLanguages.length >= NEW_LANDS_MIN_LANGUAGES) return "New Lands";
  const previous = stats.years[index - 1];
  if (previous && year.conventionalShare - previous.conventionalShare > 0.2) return "Finding Your Voice";
  return "The Grind";
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function storyFor(year: YearStats, index: number, stats: Stats, firsts: First[], achievements: Achievement[]): string {
  const sentences: string[] = [];
  const repoCount = year.repos.length;
  sentences.push(
    `${formatNumber(year.commits)} commits across ${repoCount} ${repoCount === 1 ? "repo" : "repos"}${year.topRepo && repoCount > 1 ? `, mostly in ${year.topRepo}` : ""}.`,
  );

  const yearFirsts = firsts.filter((first) => first.date.getUTCFullYear() === year.year);
  if (yearFirsts.length) sentences.push(`${formatList(yearFirsts.map((first) => first.label))}.`);

  if (index > 0 && year.newLanguages.length) sentences.push(`You picked up ${formatList(year.newLanguages)}.`);

  if (year.deleted > year.added) {
    sentences.push(`You deleted more than you wrote: ${formatNumber(year.deleted)} lines gone.`);
  }

  const previous = stats.years[index - 1];
  const share = Math.round(year.conventionalShare * PERCENT);
  if (previous && share - Math.round(previous.conventionalShare * PERCENT) >= 20) {
    sentences.push(`${share}% of your commit messages followed conventional commits, up from ${Math.round(previous.conventionalShare * PERCENT)}%.`);
  }

  const unlocked = achievements.filter((achievement) => achievement.kind === "milestone" && achievement.unlockedAt?.getUTCFullYear() === year.year);
  if (unlocked.length) sentences.push(`Unlocked ${formatList(unlocked.map((achievement) => achievement.name))}.`);

  return sentences.join(" ");
}

export function buildChapters(stats: Stats, firsts: First[], achievements: Achievement[], now: Date): Chapter[] {
  return stats.years.map((year, index) => ({
    year: year.year,
    title: titleFor(year, index, stats, year.year === now.getUTCFullYear()),
    story: storyFor(year, index, stats, firsts, achievements),
    skills: year.languages.slice(0, 5),
    newSkills: year.newLanguages,
  }));
}
