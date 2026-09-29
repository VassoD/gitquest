import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { runGit } from "../scan/git.js";
import { historyArgs, readRepoCommits, type RepoScanResult } from "../scan/read-commits.js";
import { mapWithConcurrency } from "../shared/map-with-concurrency.js";
import type { GitHubRepo } from "./api.js";

/** Clones mostly wait on the network, so more of them can run side by side than repo reads. */
const SYNC_CONCURRENCY = 8;
const CLONE_TIMEOUT_MS = 10 * 60_000;
const PARTIAL_CLONE_SUFFIX = ".partial";
const FETCH_REFSPECS = ["+refs/heads/*:refs/heads/*", "+refs/tags/*:refs/tags/*"];
/**
 * Clones hold commits and folder listings but no file contents, which are most of a repo's size.
 * Only the files touched by the player's own commits are downloaded later, see readMirrorCommits.
 */
const BLOBLESS_FILTER = "--filter=blob:none";
/** Written into each clone's config, so mirrors from older versions (full clones) get replaced. */
const LAYOUT_CONFIG_KEY = "gitquest.layout";
const BLOBLESS_LAYOUT = "blobless";
/** A submodule shows up in a diff as a commit id, not a file, and is never fetched. */
const SUBMODULE_MODE = "160000";
const NULL_OBJECT_ID = /^0+$/;
/** Abort a transfer slower than 1 KB/s for a minute, instead of hanging until the overall timeout. */
const LOW_SPEED_LIMIT_BYTES = "1000";
const LOW_SPEED_TIME_SECONDS = "60";
const GITHUB_HTTPS_PREFIX = "https://github.com/";
/** Carries no secret. It only keeps the URL from matching `insteadOf` rules for https://github.com/. */
const GITHUB_HTTPS_WITH_USER = "https://gitquest@github.com/";

export interface MirrorResult {
  repo: GitHubRepo;
  /** Where the bare clone lives, or null when there is nothing usable on disk. */
  path: string | null;
  /** Set when cloning or fetching failed. A stale copy may still be usable through `path`. */
  error?: Error;
}

export function defaultCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CACHE_HOME?.trim() || join(homedir(), ".cache");
  return join(base, "gitquest", "github");
}

export function mirrorPath(cacheDir: string, repo: GitHubRepo): string {
  return join(cacheDir, repo.owner, repo.name);
}

/**
 * Many setups rewrite https://github.com/ to SSH with `url.<ssh>.insteadOf`. SSH ignores the token and can
 * hang forever on a key prompt, so gitquest uses a URL those rules do not match.
 */
export function transportUrl(cloneUrl: string): string {
  return cloneUrl.startsWith(GITHUB_HTTPS_PREFIX) ? `${GITHUB_HTTPS_WITH_USER}${cloneUrl.slice(GITHUB_HTTPS_PREFIX.length)}` : cloneUrl;
}

/**
 * Git settings for gitquest's clones, passed through the environment so they apply to this run only.
 * The token goes in an HTTP header, so it never lands in the clone's config file or in the process list
 * the way a token in the URL or `-c` would. Credential helpers are switched off so the keychain never pops up.
 */
export function gitAuthEnv(token: string | null): NodeJS.ProcessEnv {
  const settings: [string, string][] = [
    // An empty value clears the list of helpers inherited from the user's config.
    ["credential.helper", ""],
    ["http.lowSpeedLimit", LOW_SPEED_LIMIT_BYTES],
    ["http.lowSpeedTime", LOW_SPEED_TIME_SECONDS],
  ];
  if (token) settings.push(["http.extraHeader", `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`]);

  const env: NodeJS.ProcessEnv = { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: String(settings.length) };
  settings.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return env;
}

async function isBloblessMirror(target: string): Promise<boolean> {
  if (!existsSync(join(target, "HEAD"))) return false;
  try {
    return (await runGit(target, ["config", "--get", LAYOUT_CONFIG_KEY])).trim() === BLOBLESS_LAYOUT;
  } catch {
    return false;
  }
}

async function syncOne(repo: GitHubRepo, cacheDir: string, env: NodeJS.ProcessEnv): Promise<string> {
  const target = mirrorPath(cacheDir, repo);
  const options = { env, timeoutMs: CLONE_TIMEOUT_MS };
  const url = transportUrl(repo.cloneUrl);

  if (await isBloblessMirror(target)) {
    // Point origin at the current URL so renamed or transferred repos keep working, file downloads included.
    await runGit(target, ["remote", "set-url", "origin", url]);
    await runGit(target, ["fetch", "--quiet", "--prune", BLOBLESS_FILTER, "origin", ...FETCH_REFSPECS], options);
    return target;
  }

  // Clone next to the target and move it in place, so an interrupted clone never looks like a finished one.
  const partial = `${target}${PARTIAL_CLONE_SUFFIX}`;
  await rm(partial, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await runGit(dirname(target), ["clone", "--bare", "--quiet", BLOBLESS_FILTER, url, partial], options);
  await runGit(partial, ["config", LAYOUT_CONFIG_KEY, BLOBLESS_LAYOUT]);
  await rm(target, { recursive: true, force: true });
  await rename(partial, target);
  return target;
}

/** Clones new repos and fetches known ones into the cache. A failing repo is reported, not fatal. */
export async function syncMirrors(
  repos: GitHubRepo[],
  cacheDir: string,
  token: string | null,
  onProgress?: (done: number, total: number) => void,
): Promise<MirrorResult[]> {
  const env = gitAuthEnv(token);
  return mapWithConcurrency(
    repos,
    SYNC_CONCURRENCY,
    async (repo): Promise<MirrorResult> => {
      try {
        return { repo, path: await syncOne(repo, cacheDir, env) };
      } catch (error: unknown) {
        const stale = mirrorPath(cacheDir, repo);
        return { repo, path: existsSync(join(stale, "HEAD")) ? stale : null, error: error instanceof Error ? error : new Error(String(error)) };
      }
    },
    onProgress,
  );
}

/** File versions on both sides of each change in these authors' commits, as `git log --raw` lists them. */
function touchedObjectIds(rawLog: string): Set<string> {
  const objectIds = new Set<string>();
  for (const line of rawLog.split("\n")) {
    if (!line.startsWith(":")) continue;
    const [oldMode, newMode, oldId, newId] = line.slice(1).split(/\s+/);
    if (oldMode !== SUBMODULE_MODE && oldId && !NULL_OBJECT_ID.test(oldId)) objectIds.add(oldId);
    if (newMode !== SUBMODULE_MODE && newId && !NULL_OBJECT_ID.test(newId)) objectIds.add(newId);
  }
  return objectIds;
}

async function missingObjectIds(repoPath: string, objectIds: Set<string>): Promise<string[]> {
  // Without GIT_NO_LAZY_FETCH, asking about a missing file would download it, one request per file.
  const output = await runGit(repoPath, ["cat-file", "--batch-check"], { env: { GIT_NO_LAZY_FETCH: "1" }, input: `${[...objectIds].join("\n")}\n` });
  return output.split("\n").flatMap((line) => (line.endsWith(" missing") ? [line.split(" ")[0] ?? ""] : [])).filter(Boolean);
}

/**
 * Downloads the files these authors' commits touched in one request. Left to itself, git would fetch them
 * one commit at a time while computing line stats, which is much slower.
 */
async function prefetchAuthorFiles(repoPath: string, authorEmails: string[], env: NodeJS.ProcessEnv): Promise<void> {
  // --raw lists file ids straight from the folder listings, so it needs no file contents itself.
  const rawLog = await runGit(repoPath, ["log", ...historyArgs(authorEmails), "--raw", "--no-renames", "--no-abbrev", "--pretty=format:"]);
  const missing = await missingObjectIds(repoPath, touchedObjectIds(rawLog));
  if (!missing.length) return;
  await runGit(
    repoPath,
    // The same flags git uses for its own on-demand downloads. noop skips negotiating what we already have.
    ["-c", "fetch.negotiationAlgorithm=noop", "fetch", "--quiet", "--no-tags", "--no-write-fetch-head", "--recurse-submodules=no", BLOBLESS_FILTER, "--stdin", "origin"],
    { env, timeoutMs: CLONE_TIMEOUT_MS, input: `${missing.join("\n")}\n` },
  );
}

/** Reads these authors' commits, with line stats, from mirrors made by syncMirrors. */
export async function readMirrorCommits(
  repoPaths: string[],
  authorEmails: string[],
  token: string | null,
  onProgress?: (done: number, total: number) => void,
): Promise<RepoScanResult[]> {
  const env = gitAuthEnv(token);
  return mapWithConcurrency(
    repoPaths,
    SYNC_CONCURRENCY,
    async (repoPath): Promise<RepoScanResult> => {
      try {
        // If the batch download fails, reading still works: git then fetches what it needs as it goes.
        await prefetchAuthorFiles(repoPath, authorEmails, env).catch(() => undefined);
        const commits = await readRepoCommits(repoPath, { authorEmails, runGit: { env, timeoutMs: CLONE_TIMEOUT_MS } });
        return { repoPath, commits };
      } catch (error: unknown) {
        return { repoPath, commits: [], error: error instanceof Error ? error : new Error(String(error)) };
      }
    },
    onProgress,
  );
}
