import { readdir } from "node:fs/promises";
import { join } from "node:path";

const SKIPPED_DIRS = new Set(["node_modules", ".next", "dist", "build", "vendor", ".venv", "venv", "target", ".cache"]);
const DEFAULT_MAX_DEPTH = 4;

/** Walks each root looking for folders that contain a `.git` entry. Does not descend into found repos. */
export async function findRepos(roots: string[], maxDepth = DEFAULT_MAX_DEPTH): Promise<string[]> {
  const found = new Set<string>();

  async function walk(dir: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.name === ".git")) {
      found.add(dir);
      return;
    }
    if (depth >= maxDepth) return;
    const children = entries.filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith(".") && !SKIPPED_DIRS.has(entry.name),
    );
    await Promise.all(children.map((child) => walk(join(dir, child.name), depth + 1)));
  }

  await Promise.all(roots.map((root) => walk(root, 0)));
  return [...found].sort();
}
