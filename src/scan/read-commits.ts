import { basename } from "node:path";
import { runGit, type RunGitOptions } from "./git.js";
import { GIT_LOG_FORMAT, parseGitLog } from "./parse-git-log.js";
import type { Commit } from "./types.js";

const REPO_CONCURRENCY = 4;

export interface RepoScanResult {
  repoPath: string;
  commits: Commit[];
  error?: Error;
}

export interface ReadCommitsOptions {
  /** Only read commits by these emails, ignoring case. By default every author is read. */
  authorEmails?: string[];
  /** Skip per-file stats, so git never needs file contents. Enough to list authors. */
  withoutStats?: boolean;
  runGit?: RunGitOptions;
}

/** The commits gitquest reads, as `git log` / `git rev-list` arguments. */
export function historyArgs(authorEmails?: string[]): string[] {
  const authorFilter = authorEmails
    ? // Wrapping the email in <> matches it whole, so ada@x.com does not also match 'bada@x.com'.
      ["--fixed-strings", "--regexp-ignore-case", ...authorEmails.map((email) => `--author=<${email}>`)]
    : [];
  // Real branches only. --all would also pick up stashes, notes and hidden refs that AI coding tools create.
  return ["--branches", "--tags", "--remotes", "--no-merges", ...authorFilter];
}

export async function readRepoCommits(repoPath: string, options: ReadCommitsOptions = {}): Promise<Commit[]> {
  if (options.authorEmails?.length === 0) return [];
  const statsArgs = options.withoutStats
    ? []
    : // Rename detection keeps a moved folder from counting as thousands of new lines.
      ["--numstat", "--summary", "--find-renames"];
  const output = await runGit(
    repoPath,
    ["log", ...historyArgs(options.authorEmails), ...statsArgs, `--pretty=format:${GIT_LOG_FORMAT}`],
    options.runGit,
  );
  return parseGitLog(output, basename(repoPath));
}

/** Reads every repo with a small concurrency limit. A broken repo is reported, not fatal. */
export async function readAllCommits(
  repoPaths: string[],
  onProgress?: (done: number, total: number) => void,
  options: ReadCommitsOptions = {},
): Promise<RepoScanResult[]> {
  const results: RepoScanResult[] = [];
  const queue = [...repoPaths];
  let done = 0;

  async function worker(): Promise<void> {
    for (let repoPath = queue.shift(); repoPath; repoPath = queue.shift()) {
      try {
        results.push({ repoPath, commits: await readRepoCommits(repoPath, options) });
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
