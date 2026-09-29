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
    // Real branches only. --all would also pick up stashes, notes and hidden refs that AI coding tools create.
    "--branches",
    "--tags",
    "--remotes",
    "--no-merges",
    "--numstat",
    "--summary",
    // Rename detection keeps a moved folder from counting as thousands of new lines.
    "--find-renames",
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

/**
 * The same work can show up several times: in several clones or forks (same hash),
 * or rebased and cherry-picked onto other branches (new hash, same author, date and message).
 */
function identityKey(commit: Commit): string {
  return `${commit.authorEmail}\u0000${commit.authoredAt.getTime()}\u0000${commit.subject}`;
}

export function dedupeCommits(commits: Commit[]): Commit[] {
  const seen = new Map<string, Commit>();
  for (const commit of commits) {
    const key = identityKey(commit);
    if (!seen.has(key)) seen.set(key, commit);
  }
  return [...seen.values()].sort((a, b) => a.authoredAt.getTime() - b.authoredAt.getTime());
}
