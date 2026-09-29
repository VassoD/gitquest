import type { IconName, Rarity } from "../analyze/types.js";

const ICON_GRID = 8;

const PATTERNS: Record<IconName, string[]> = {
  sword: ["......##", ".....#.#", "....#.#.", "#..#.#..", ".##.#...", "..##....", ".#..#...", "#......."],
  box: ["..####..", ".#....#.", "########", "#......#", "#.#..#.#", "#......#", "#......#", "########"],
  broom: [".......#", "......#.", ".....#..", "....#...", "..###...", ".#####..", "#.#.#...", ".#.#...."],
  crown: ["#..#..#.", "#.###.#.", "########", "#......#", "#.#..#.#", "########", "........", "........"],
  scroll: [".######.", "#......#", ".#.##.#.", ".#....#.", ".#.###.#", ".#....#.", "#......#", ".######."],
  moon: ["...###..", "..##....", ".##.....", ".##.....", ".##.....", ".##.....", "..##....", "...###.."],
  gear: ["...##...", ".#.##.#.", "..####..", "###..###", "###..###", "..####..", ".#.##.#.", "...##..."],
  gem: ["..####..", ".#.##.#.", "########", ".#....#.", "..#..#..", "...##...", "........", "........"],
  flame: ["...#....", "..##....", "..###.#.", ".#####..", ".######.", "###..###", "##....##", ".######."],
  star: ["...##...", "...##...", "########", ".######.", "..####..", ".##..##.", "##....##", "........"],
  shield: ["########", "#......#", "#.####.#", "#.####.#", ".#.##.#.", ".#....#.", "..#..#..", "...##..."],
  quill: [".......#", "......##", ".....##.", "....##..", "...##...", "..##....", ".#......", "#......."],
  sun: ["#..#..#.", ".#.#.#..", "..###...", "#######.", "..###...", ".#.#.#..", "#..#..#.", "........"],
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#8a97a8",
  rare: "#4aa3ff",
  epic: "#a57cf5",
  legendary: "#f2b53a",
};

/** Renders an 8x8 pixel icon as SVG rects positioned at (x, y) and scaled to `size`. */
export function iconRects(icon: IconName, color: string, x: number, y: number, size: number): string {
  const pixel = size / ICON_GRID;
  const rects: string[] = [];
  PATTERNS[icon].forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell === "#") {
        rects.push(`<rect x="${x + columnIndex * pixel}" y="${y + rowIndex * pixel}" width="${pixel}" height="${pixel}" fill="${color}"/>`);
      }
    });
  });
  return rects.join("");
}

export function iconSvg(icon: IconName, color: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true">${iconRects(icon, color, 0, 0, size)}</svg>`;
}
