import type { Profile } from "../analyze/types.js";
import { escapeXml } from "./escape.js";
import { compactNumber, formatNumber } from "./format.js";
import { iconRects, RARITY_COLORS } from "./icons.js";

/** GitHub renders READMEs in light and dark, so the card carries its own dark background. */
const CARD = {
  bg: "#0d1117",
  panel: "#161b22",
  border: "#30363d",
  fg: "#e6edf3",
  muted: "#8b949e",
  faint: "#484f58",
  gold: "#f2b53a",
  added: "#39d353",
  deleted: "#f47067",
  font: `font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"`,
} as const;

const FULL_WIDTH = 495;
const FULL_HEIGHT = 195;
const FULL_PADDING = 24;
const FULL_ICON_LIMIT = 9;
const BADGE_TILE = 44;
const BADGE_GAP = 8;
const BADGE_PADDING = 12;

function xpShare(profile: Profile): number {
  const { xp, currentLevelXp, nextLevelXp } = profile.level;
  return Math.min(1, Math.max(0, (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)));
}

function unlockedCount(profile: Profile): string {
  return `${profile.achievements.filter((achievement) => achievement.unlocked).length}/${profile.achievements.length}`;
}

export function renderPlayerCard(profile: Profile): string {
  const barWidth = FULL_WIDTH - FULL_PADDING * 2;
  const since = profile.stats.firstCommitAt?.getUTCFullYear();
  const unlocked = profile.achievements.filter((achievement) => achievement.unlocked).slice(0, FULL_ICON_LIMIT);
  const icons = unlocked
    .map((achievement, index) => {
      const x = FULL_PADDING + index * 44;
      const color = RARITY_COLORS[achievement.rarity];
      return `<g><title>${escapeXml(achievement.name)}</title><rect x="${x}" y="138" width="36" height="36" rx="4" fill="${CARD.panel}" stroke="${color}" stroke-width="1.5"/>${iconRects(achievement.icon, color, x + 6, 144, 24)}</g>`;
    })
    .join("");

  const stat = (x: number, label: string, value: string): string =>
    `<text x="${x}" y="100" ${CARD.font} font-size="11" fill="${CARD.muted}">${label}</text><text x="${x}" y="118" ${CARD.font} font-size="15" fill="${CARD.fg}">${value}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FULL_WIDTH}" height="${FULL_HEIGHT}" viewBox="0 0 ${FULL_WIDTH} ${FULL_HEIGHT}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(profile.player)} on gitquest: level ${profile.level.level}">
  <rect x=".5" y=".5" width="${FULL_WIDTH - 1}" height="${FULL_HEIGHT - 1}" rx="6" fill="${CARD.bg}" stroke="${CARD.border}"/>
  <text x="${FULL_PADDING}" y="36" ${CARD.font} font-size="18" font-weight="700" fill="${CARD.fg}">${escapeXml(profile.player)}</text>
  <text x="${FULL_PADDING}" y="56" ${CARD.font} font-size="12" fill="${CARD.gold}">Lv. ${profile.level.level} · ${escapeXml(profile.className)}</text>
  ${since ? `<text x="${FULL_WIDTH - FULL_PADDING}" y="36" ${CARD.font} font-size="11" fill="${CARD.muted}" text-anchor="end">since ${since}</text>` : ""}
  <rect x="${FULL_PADDING}" y="68" width="${barWidth}" height="10" rx="2" fill="${CARD.panel}" stroke="${CARD.border}"/>
  <rect x="${FULL_PADDING}" y="68" width="${(barWidth * xpShare(profile)).toFixed(1)}" height="10" rx="2" fill="${CARD.gold}"/>
  ${stat(FULL_PADDING, "COMMITS", formatNumber(profile.stats.totalCommits))}
  ${stat(140, "REPOS", String(profile.stats.repos.length))}
  <text x="230" y="100" ${CARD.font} font-size="11" fill="${CARD.muted}">LINES</text>
  <text x="230" y="118" ${CARD.font} font-size="15" fill="${CARD.added}">+${compactNumber(profile.stats.added)} <tspan fill="${CARD.deleted}">-${compactNumber(profile.stats.deleted)}</tspan></text>
  ${stat(390, "ACHIEVED", unlockedCount(profile))}
  ${icons}
  <text x="${FULL_WIDTH - FULL_PADDING}" y="186" ${CARD.font} font-size="9" fill="${CARD.faint}" text-anchor="end">gitquest</text>
</svg>`;
}

export function renderAchievementStrip(profile: Profile): string {
  const unlocked = profile.achievements.filter((achievement) => achievement.unlocked);
  const tiles = Math.max(unlocked.length, 1);
  const width = BADGE_PADDING * 2 + tiles * BADGE_TILE + (tiles - 1) * BADGE_GAP;
  const height = BADGE_PADDING * 2 + BADGE_TILE;
  const cells = unlocked
    .map((achievement, index) => {
      const x = BADGE_PADDING + index * (BADGE_TILE + BADGE_GAP);
      const color = RARITY_COLORS[achievement.rarity];
      return `<g><title>${escapeXml(achievement.name)}: ${escapeXml(achievement.description)}</title><rect x="${x}" y="${BADGE_PADDING}" width="${BADGE_TILE}" height="${BADGE_TILE}" rx="4" fill="${CARD.panel}" stroke="${color}" stroke-width="1.5"/>${iconRects(achievement.icon, color, x + 8, BADGE_PADDING + 8, 28)}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" role="img" aria-label="${unlocked.length} gitquest achievements unlocked">
  <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="6" fill="${CARD.bg}" stroke="${CARD.border}"/>${cells}
</svg>`;
}

export function renderMiniBadge(profile: Profile): string {
  const value = `Lv.${profile.level.level} · ${unlockedCount(profile)}`;
  const labelWidth = 84;
  const valueWidth = 16 + value.length * 7;
  const width = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" viewBox="0 0 ${width} 28" role="img" aria-label="gitquest level ${profile.level.level}">
  <rect width="${width}" height="28" rx="4" fill="${CARD.border}"/>
  <path d="M4 0h${labelWidth - 4}v28H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z" fill="${CARD.panel}"/>
  <g shape-rendering="crispEdges">${iconRects("crown", CARD.gold, 8, 7, 14)}</g>
  <text x="28" y="18" ${CARD.font} font-size="11" fill="${CARD.fg}">gitquest</text>
  <text x="${labelWidth + 10}" y="18" ${CARD.font} font-size="11" font-weight="700" fill="${CARD.gold}">${value}</text>
</svg>`;
}
