import type { Achievement, Profile } from "../analyze/types.js";
import { renderAvatar } from "./avatar.js";
import { renderAchievementStrip, renderMiniBadge, renderPlayerCard } from "./cards.js";
import { CLIENT_SCRIPT } from "./client-script.js";
import { escapeXml as esc } from "./escape.js";
import { compactNumber, formatDay, formatMonth, formatNumber } from "./format.js";
import { iconSvg, RARITY_COLORS } from "./icons.js";
import { REPORT_STYLES } from "./styles.js";

export const CARD_FILES = {
  full: "card.svg",
  badges: "achievements.svg",
  mini: "badge.svg",
} as const;

const HEAT_LEVELS = 4;
const LOCKED_COLOR = "#8a97a8";
const AVATAR_SIZE = 112;

function quantileThresholds(values: number[]): number[] {
  const active = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!active.length) return [1, 1, 1];
  return [0.25, 0.5, 0.75].map((quantile) => active[Math.floor(quantile * (active.length - 1))] ?? 1);
}

function heatLevel(count: number, thresholds: number[]): number {
  if (!count) return 0;
  return Math.min(HEAT_LEVELS, 1 + thresholds.filter((threshold) => count > threshold).length);
}

function weekIndex(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.min(52, Math.floor((date.getTime() - startOfYear) / 86_400_000 / 7));
}

function renderJourneyMap(profile: Profile): string {
  const thresholds = quantileThresholds(profile.stats.years.flatMap((year) => year.weeks));
  const bossWeeks = new Map<string, string[]>();
  for (const achievement of profile.achievements) {
    if (!achievement.unlockedAt) continue;
    const key = `${achievement.unlockedAt.getUTCFullYear()}-${weekIndex(achievement.unlockedAt)}`;
    bossWeeks.set(key, [...(bossWeeks.get(key) ?? []), achievement.name]);
  }

  const rows = profile.stats.years.map((year) => {
    const cells = year.weeks.map((count, week) => {
      const unlocked = bossWeeks.get(`${year.year}-${week}`);
      if (unlocked) return `<div class="cell boss" title="${year.year}, week ${week + 1}: ${esc(unlocked.join(", "))}"></div>`;
      const level = heatLevel(count, thresholds);
      return `<div class="cell${level ? ` l${level}` : ""}" title="${year.year}, week ${week + 1}: ${count} commits"></div>`;
    });
    return `<div class="yr">${year.year}</div>${cells.join("")}`;
  });
  return rows.join("");
}

function renderAchievement(achievement: Achievement): string {
  const color = achievement.unlocked ? RARITY_COLORS[achievement.rarity] : "var(--line)";
  const iconColor = achievement.unlocked ? RARITY_COLORS[achievement.rarity] : LOCKED_COLOR;
  const meta = achievement.unlocked
    ? `<div class="meta"><span class="rar">${achievement.rarity}</span><span>${achievement.unlockedAt ? formatMonth(achievement.unlockedAt) : ""}</span></div>`
    : `<div class="meta"><span class="rar" style="color:var(--muted)">Locked</span><span>${achievement.progress}%</span></div><div class="prog"><i style="width:${achievement.progress}%"></i></div>`;
  return `<article class="ach${achievement.unlocked ? "" : " locked"}" style="--r:${color}">
    <div class="ico">${iconSvg(achievement.icon, iconColor, 32)}</div>
    <div><h3>${esc(achievement.name)}</h3><p>${esc(achievement.description)}</p>${meta}</div>
  </article>`;
}

function renderChapters(profile: Profile): string {
  return profile.chapters
    .map((chapter) => {
      const chips = chapter.skills
        .map((skill) => {
          const isNew = chapter.newSkills.includes(skill);
          return `<span class="chip${isNew ? " new" : ""}">${isNew ? "+ " : ""}${esc(skill)}</span>`;
        })
        .join("");
      return `<div class="quest"><div class="y">${chapter.year}</div><div><h3>${esc(chapter.title)}</h3><p>${esc(chapter.story)}</p>${chips ? `<div class="chips">${chips}</div>` : ""}</div></div>`;
    })
    .join("");
}

function renderShowcase(profile: Profile): string {
  const variants = [
    { key: "full", label: "Player card", svg: renderPlayerCard(profile), alt: "gitquest" },
    { key: "badges", label: "Achievement strip", svg: renderAchievementStrip(profile), alt: "gitquest achievements" },
    { key: "mini", label: "Mini badge", svg: renderMiniBadge(profile), alt: "gitquest" },
  ] as const;
  const tabs = variants
    .map((variant, index) => `<button class="tab" role="tab" aria-selected="${index === 0}" data-v="${variant.key}">${variant.label}</button>`)
    .join("");
  const panels = variants
    .map((variant, index) => `<div class="stack" data-panel="${variant.key}"${index === 0 ? "" : " hidden"}>
      <div class="stage">${variant.svg}</div>
      <div class="code"><pre>![${variant.alt}](./gitquest/${CARD_FILES[variant.key]})</pre><button class="copy">Copy</button></div>
    </div>`)
    .join("");
  return `<div class="tabs" role="tablist" aria-label="Card style">${tabs}</div>${panels}`;
}

export function renderReport(profile: Profile): string {
  const { stats, level } = profile;
  const unlocked = profile.achievements.filter((achievement) => achievement.unlocked).length;
  const xpShare = Math.min(100, ((level.xp - level.currentLevelXp) / (level.nextLevelXp - level.currentLevelXp)) * 100);
  const firstYear = stats.years[0]?.year;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(profile.player)} · gitquest</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${REPORT_STYLES}</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div class="brand">git<span>quest</span></div>
    <div class="stamp">Save file generated ${formatDay(profile.generatedAt)}</div>
  </div>

  <section class="panel sheet" aria-label="Character sheet">
    ${renderAvatar(profile.player, AVATAR_SIZE)}
    <div class="who">
      <div class="label">${stats.firstCommitAt ? `Player since ${formatDay(stats.firstCommitAt)}` : "New player"}</div>
      <h1>${esc(profile.player)}</h1>
      <div class="class">Lv. ${level.level} · ${esc(profile.className)}</div>
      <div class="xp">
        <div class="xp-row"><span>XP ${formatNumber(level.xp)} / ${formatNumber(level.nextLevelXp)}</span><span>${formatNumber(level.nextLevelXp - level.xp)} XP to Lv. ${level.level + 1}</span></div>
        <div class="xp-bar"><div class="xp-fill" style="width:${xpShare.toFixed(1)}%"></div></div>
      </div>
    </div>
  </section>

  <div class="stats">
    <div class="stat"><span class="label">Commits</span><b>${formatNumber(stats.totalCommits)}</b></div>
    <div class="stat"><span class="label">Repos explored</span><b>${stats.repos.length}</b></div>
    <div class="stat"><span class="label">Lines shipped</span><b><span class="add">+${compactNumber(stats.added)}</span> <span class="del">-${compactNumber(stats.deleted)}</span></b></div>
    <div class="stat"><span class="label">Languages</span><b>${stats.languages.length}</b></div>
  </div>

  <section>
    <h2>Journey map <small>every week since ${firstYear ?? "your first commit"}</small></h2>
    <div class="panel map"><div class="map-grid">${renderJourneyMap(profile)}</div></div>
    <div class="legend">
      <span><i style="background:var(--g0)"></i>rest week</span>
      <span><i style="background:var(--g2)"></i>active</span>
      <span><i style="background:var(--g4)"></i>on fire</span>
      <span><i style="background:var(--gold)"></i>boss fight: you unlocked an achievement that week</span>
    </div>
  </section>

  <section>
    <h2>Achievements <small>${unlocked} of ${profile.achievements.length} unlocked</small></h2>
    <div class="ach-grid">${profile.achievements.map(renderAchievement).join("")}</div>
  </section>

  <section>
    <h2>Quest log <small>your story, chapter by chapter</small></h2>
    <div class="panel">${renderChapters(profile)}</div>
  </section>

  <section>
    <h2>Show it off <small>drop it in your GitHub profile README</small></h2>
    ${renderShowcase(profile)}
    <p class="note">Copy the SVG files from this folder into a <code>gitquest/</code> folder in your profile repo (github.com/you/you), then paste the snippet into its README. Everything was computed on your machine.</p>
  </section>
</div>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}
