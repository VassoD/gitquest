import { basename } from "node:path";
import { runGit } from "./git.js";
import { GIT_LOG_FORMAT, parseGitLog } from "./parse-git-log.js";
import type { Commit } from "./types.js";

const REPO_CONCURRENCY = 4;

export interface RepoScanResult {
  repoPath: string;
  commits: Commit[];
  error?: Error;
}

async function readRepoCommits(repoPath: string): Promise<Commit[]> {
  const output = await runGit(repoPath, [
    "log",
    "--all",
    "--no-merges",
    "--numstat",
    "--summary",
    "--no-renames",
    `--pretty=format:${GIT_LOG_FORMAT}`,
  ]);
  return parseGitLog(output, basename(repoPath));
}

/** Reads every repo with a small concurrency limit. A broken repo is reported, not fatal. */
export async function readAllCommits(
  repoPaths: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<RepoScanResult[]> {
  const results: RepoScanResult[] = [];
  const queue = [...repoPaths];
  let done = 0;

  async function worker(): Promise<void> {
    for (let repoPath = queue.shift(); repoPath; repoPath = queue.shift()) {
      try {
        results.push({ repoPath, commits: await readRepoCommits(repoPath) });
      } catch (error: unknown) {
        results.push({ repoPath, commits: [], error: error instanceof Error ? error : new Error(String(error)) });
      }
      done += 1;
      onProgress?.(done, repoPaths.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(REPO_CONCURRENCY, repoPaths.length) }, worker));
  return results;
}

/** Same commit can appear in several clones or forks. Keep one. */
export function dedupeCommits(commits: Commit[]): Commit[] {
  const seen = new Map<string, Commit>();
  for (const commit of commits) {
    if (!seen.has(commit.hash)) seen.set(commit.hash, commit);
  }
  return [...seen.values()].sort((a, b) => a.authoredAt.getTime() - b.authoredAt.getTime());
}
