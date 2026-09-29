import { styleText } from "node:util";
import { spinner } from "@clack/prompts";

export interface Progress {
  /** Replaces the text shown next to the animation. */
  message: (text: string) => void;
  /** Reports how many items are done, filling the XP bar when a total was given. */
  advance: (done: number) => void;
  done: (text: string) => void;
}

/** A tiny hero dancing while git works, in the spirit of the report's pixel art. */
export const HERO_FRAMES = ["(>'-')>", "^('-')^", "<('-'<)", "^('-')^"];
const HERO_FRAME_MS = 160;

/** Rotated through while a step runs, so a long clone never looks frozen. */
export const QUEST_QUIPS = [
  "rolling for initiative",
  "grinding XP",
  "looting old branches",
  "consulting the git oracle",
  "dodging merge conflicts",
  "sharpening the rebase sword",
  "counting lines by torchlight",
  "polishing achievements",
  "befriending the commit goblins",
  "untangling detached HEADs",
];
const QUIP_ROTATE_MS = 3200;

const XP_BAR_WIDTH = 16;
const DEFAULT_COLUMNS = 80;
/**
 * Room taken by what clack adds around our text: the hero, two spaces and a timer like " [10m 59s]",
 * plus one spare column. A line that wraps is redrawn on a new line every frame instead of in place.
 */
const RESERVED_COLUMNS = (HERO_FRAMES[0] ?? "").length + 2 + 10 + 1;
/** Below this many label characters, the bar is dropped and only the count is kept. */
const MIN_LABEL_COLUMNS = 8;
const ELLIPSIS = "…";
const XP_FILLED = "█";
const XP_EMPTY = "░";

export function xpBar(done: number, total: number, width = XP_BAR_WIDTH): { filled: string; empty: string } {
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const filledCells = Math.floor(share * width);
  return { filled: XP_FILLED.repeat(filledCells), empty: XP_EMPTY.repeat(width - filledCells) };
}

function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  return width <= ELLIPSIS.length ? "" : `${text.slice(0, width - ELLIPSIS.length)}${ELLIPSIS}`;
}

/** Builds the line so it fits in `width` columns: the quip goes first, then the bar, then label characters. */
export function questLine(label: string, quip: string, done: number, total: number | undefined, width: number): string {
  const count = total ? ` ${done}/${total}` : "";
  const fullBar = total ? xpBar(done, total) : null;
  const bar = fullBar && fullBar.filled.length + fullBar.empty.length + 1 + count.length + MIN_LABEL_COLUMNS <= width ? fullBar : null;
  const progressText = bar ? ` ${bar.filled}${bar.empty}${count}` : count;
  const flavorText = ` · ${quip}`;
  const withFlavor = label.length + progressText.length + flavorText.length <= width;
  const fittedLabel = truncate(label, width - progressText.length - (withFlavor ? flavorText.length : 0));

  const progress = bar ? ` ${styleText("yellow", bar.filled)}${styleText("dim", bar.empty)}${count}` : count;
  return `${fittedLabel}${progress}${withFlavor ? styleText("dim", flavorText) : ""}`;
}

function availableColumns(): number {
  return Math.max(0, (process.stdout.columns || DEFAULT_COLUMNS) - RESERVED_COLUMNS);
}

/** An animated spinner with an XP bar (when `total` is known), a rotating quip and an elapsed timer. */
export function startQuestProgress(label: string, total?: number): Progress {
  const indicator = spinner({ frames: HERO_FRAMES, delay: HERO_FRAME_MS, indicator: "timer", styleFrame: (frame) => styleText("green", frame) });
  let text = label;
  let done = 0;
  let quipIndex = Math.floor(Math.random() * QUEST_QUIPS.length);
  const line = (): string => questLine(text, QUEST_QUIPS[quipIndex] ?? "", done, total, availableColumns());
  const render = (): void => indicator.message(line());

  indicator.start(line());
  const rotation = setInterval(() => {
    quipIndex = (quipIndex + 1) % QUEST_QUIPS.length;
    render();
  }, QUIP_ROTATE_MS);
  rotation.unref();

  return {
    message: (next) => {
      text = next;
      render();
    },
    advance: (next) => {
      done = next;
      render();
    },
    done: (final) => {
      clearInterval(rotation);
      indicator.stop(final);
    },
  };
}
