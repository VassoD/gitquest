const AVATAR_GRID = 16;
const HALF = AVATAR_GRID / 2;
const MARGIN = 2;
const AVATAR_COLORS = ["#39d353", "#26a641", "#f2b53a"];

function hashString(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/** A symmetric pixel avatar derived from the player name, like a GitHub identicon. */
export function renderAvatar(player: string, size: number): string {
  const random = seededRandom(hashString(player));
  const pixel = size / AVATAR_GRID;
  const rects: string[] = [];
  for (let row = MARGIN; row < AVATAR_GRID - MARGIN; row++) {
    for (let column = MARGIN; column < HALF; column++) {
      if (random() <= 0.5) continue;
      const color = AVATAR_COLORS[Math.floor(random() * AVATAR_COLORS.length)];
      for (const x of [column, AVATAR_GRID - 1 - column]) {
        rects.push(`<rect x="${x * pixel}" y="${row * pixel}" width="${pixel}" height="${pixel}" fill="${color}"/>`);
      }
    }
  }
  return `<svg class="avatar" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Pixel avatar">${rects.join("")}</svg>`;
}
