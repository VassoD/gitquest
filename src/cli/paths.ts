import { homedir } from "node:os";
import { resolve } from "node:path";

export function expandHome(path: string): string {
  if (path === "~") return homedir();
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : path;
}

export function shortenHome(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}
