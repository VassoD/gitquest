#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { join, resolve } from "node:path";
import { cancel, intro, log as clackLog, outro } from "@clack/prompts";
import { buildProfile } from "../analyze/build-profile.js";
import type { Profile } from "../analyze/types.js";
import { accountEmails, resolveGitHubSource, type GitHubSource } from "../github/account.js";
import { GitHubClient } from "../github/api.js";
import { GitHubApiError, GitHubPublishError } from "../github/errors.js";
import { defaultCacheDir, readMirrorCommits, syncMirrors } from "../github/mirror.js";
import { type CardFile, publishCards } from "../github/publish.js";
import { resolveGitHubToken } from "../github/token.js";
import { collectAuthors, suggestOwnEmails, type KnownSelf } from "../identity/authors.js";
import { renderAchievementStrip, renderMiniBadge, renderPlayerCard } from "../report/cards.js";
import { CARD_FILES, renderReport } from "../report/html.js";
import { GitCommandError, GitNotFoundError, NoReposFoundError } from "../scan/errors.js";
import { findRepos } from "../scan/find-repos.js";
import { readGitConfig } from "../scan/git.js";
import { dedupeCommits, readAllCommits, type RepoScanResult } from "../scan/read-commits.js";
import type { Commit } from "../scan/types.js";
import { HELP_TEXT, parseCliArgs, UsageError, type CliOptions } from "./args.js";
import { askRoots, askToOpen, CancelledError, canPrompt, pickEmails } from "./interactive.js";
import { openFile } from "./open-file.js";
import { type Progress, startQuestProgress } from "./quest-progress.js";
import { expandHome, shortenHome } from "./paths.js";

const TOP_EMAILS_SHOWN = 20;

/** Plain output for --no-input and piped runs, prompt-styled output otherwise. */
interface Ui {
  info: (message: string) => void;
  warn: (message: string) => void;
  /** With a `total`, shows an XP bar that fills as `advance` reports how many items are done. */
  progress: (message: string, total?: number) => Progress;
}

function plainUi(): Ui {
  const write = (message: string): void => {
    process.stderr.write(`${message}\n`);
  };
  return {
    info: write,
    warn: write,
    progress: (message) => {
      write(message);
      return { message: () => undefined, advance: () => undefined, done: write };
    },
  };
}

function promptUi(): Ui {
  return {
    info: (message) => clackLog.info(message),
    warn: (message) => clackLog.warn(message),
    progress: startQuestProgress,
  };
}

async function readVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };
  return packageJson.version ?? "unknown";
}

function pluralRepos(count: number): string {
  return `${count} ${count === 1 ? "repo" : "repos"}`;
}

async function findLocalRepos(roots: string[], depth: number, ui: Ui): Promise<string[]> {
  if (!roots.length) return [];
  const search = ui.progress(`Looking for repos in ${roots.map(shortenHome).join(", ")}`);
  const repoPaths = await findRepos(roots, depth);
  search.done(repoPaths.length ? `Found ${pluralRepos(repoPaths.length)}` : "No repos found");
  return repoPaths;
}

interface GitHubSync {
  source: GitHubSource;
  repoPaths: string[];
  token: string | null;
}

async function syncGitHub(login: string, ui: Ui): Promise<GitHubSync> {
  const token = await resolveGitHubToken();
  const listing = ui.progress(`Listing @${login}'s repos on GitHub`);
  let source: GitHubSource;
  try {
    source = await resolveGitHubSource(new GitHubClient({ token }), login, {
      onCheckProgress: (done, total) => listing.message(`Checking org and shared repos for your commits (${done}/${total})`),
    });
  } catch (error: unknown) {
    listing.done("Could not list GitHub repos");
    throw error;
  }
  const others = source.repos.length - source.ownedCount;
  const breakdown = `${source.ownedCount} owned, ${others} more with @${source.account.login}'s commits`;
  listing.done(`Found ${pluralRepos(source.repos.length)} on GitHub: ${breakdown}${source.includesPrivate ? "" : " (public only)"}`);
  if (!source.includesPrivate) {
    ui.warn(token
      ? `Your GitHub token belongs to another account, so @${source.account.login}'s private repos are left out.`
      : "No GitHub token found, so only public repos you own are included. Set GITHUB_TOKEN or run `gh auth login` to add private repos and the ones you contributed to.");
  }
  if (!source.repos.length) return { source, repoPaths: [], token };

  const cacheDir = defaultCacheDir();
  const syncing = ui.progress("Syncing repos", source.repos.length);
  const results = await syncMirrors(source.repos, cacheDir, token, syncing.advance);
  syncing.done(`Synced ${results.filter((result) => !result.error).length}/${pluralRepos(results.length)} into ${shortenHome(cacheDir)}`);
  for (const failed of results.filter((result) => result.error)) {
    const reason = failed.error instanceof GitCommandError ? failed.error.stderr.trim().split("\n")[0] : failed.error?.message;
    ui.warn(`Could not sync ${failed.repo.fullName}${failed.path ? ", using the copy from last time" : ""}: ${reason}`);
  }
  return { source, repoPaths: results.flatMap((result) => (result.path ? [result.path] : [])), token };
}

interface History {
  /** Commits from local repos, with line stats. */
  local: Commit[];
  /** Every commit found, for picking emails. Commits from GitHub mirrors have no line stats yet. */
  all: Commit[];
}

/** GitHub mirrors hold no file contents yet, so only who committed what is read from them at this point. */
async function readCommits(localRepos: string[], mirrorRepos: string[], ui: Ui): Promise<History> {
  const total = localRepos.length + mirrorRepos.length;
  const reading = ui.progress("Reading your history", total);
  const progressFrom = (offset: number) => (done: number): void => reading.advance(offset + done);
  const localResults = await readAllCommits(localRepos, progressFrom(0));
  const mirrorResults = await readAllCommits(mirrorRepos, progressFrom(localRepos.length), { withoutStats: true });
  const local = localResults.flatMap((result) => result.commits);
  const all = dedupeCommits([...local, ...mirrorResults.flatMap((result) => result.commits)]);
  reading.done(`Read ${all.length.toLocaleString("en-US")} commits`);
  reportSkipped([...localResults, ...mirrorResults], ui);
  return { local, all };
}

/** Downloads only the files the chosen emails' commits touched, then reads those commits with line stats. */
async function readMirrorStats(github: GitHubSync | null, emails: string[], ui: Ui): Promise<Commit[]> {
  if (!github?.repoPaths.length) return [];
  const reading = ui.progress("Fetching the files your commits touched", github.repoPaths.length);
  const results = await readMirrorCommits(github.repoPaths, emails, github.token, reading.advance);
  const commits = results.flatMap((result) => result.commits);
  reading.done(`Read line stats for ${commits.length.toLocaleString("en-US")} GitHub commits`);
  reportSkipped(results, ui);
  return commits;
}

function reportSkipped(results: RepoScanResult[], ui: Ui): void {
  for (const failed of results.filter((result) => result.error)) {
    const reason = failed.error instanceof GitCommandError ? failed.error.stderr.trim().split("\n")[0] : failed.error?.message;
    ui.warn(`Skipped ${shortenHome(failed.repoPath)}: ${reason}`);
  }
}

function printEmailCounts(commits: Commit[]): void {
  const lines = collectAuthors(commits)
    .slice(0, TOP_EMAILS_SHOWN)
    .map((author) => `  ${String(author.commits).padStart(7)}  ${author.email}`);
  process.stderr.write(`\nAuthor emails found (commits):\n${lines.join("\n")}\n\nPass the ones that are you with -e, for example: gitquest ~/code -e a@x.com -e b@y.com\n`);
}

/** `knownEmails` are addresses we are sure about, like the git config email and the GitHub account's noreply ones. */
async function chooseEmails(options: CliOptions, commits: Commit[], interactive: boolean, self: KnownSelf, knownEmails: string[]): Promise<string[]> {
  if (options.emails.length) return options.emails;
  const authors = collectAuthors(commits);
  if (interactive) {
    const candidates = knownEmails.length ? knownEmails : [null];
    const suggested = new Set(candidates.flatMap((email) => suggestOwnEmails(authors, { email, name: self.name })));
    return pickEmails(authors, [...suggested]);
  }
  if (!knownEmails.length) throw new UsageError("No email to match commits against. Pass one with --email you@example.com.");
  return knownEmails;
}

function renderCards(profile: Profile): CardFile[] {
  return [
    { name: CARD_FILES.full, svg: renderPlayerCard(profile) },
    { name: CARD_FILES.badges, svg: renderAchievementStrip(profile) },
    { name: CARD_FILES.mini, svg: renderMiniBadge(profile) },
  ];
}

async function writeReport(profile: Profile, cards: CardFile[], outDir: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const reportPath = join(outDir, "index.html");
  await Promise.all([writeFile(reportPath, renderReport(profile)), ...cards.map((card) => writeFile(join(outDir, card.name), card.svg))]);
  return reportPath;
}

interface PublishTarget {
  client: GitHubClient;
  login: string;
}

/** Checked before scanning, so a missing or wrong token fails fast instead of after a long sync. */
async function resolvePublishTarget(githubLogin: string | null): Promise<PublishTarget> {
  const token = await resolveGitHubToken();
  if (!token) throw new GitHubPublishError("--publish needs a GitHub token for your account. Set GITHUB_TOKEN or run `gh auth login`.");
  const client = new GitHubClient({ token });
  const owner = await client.getAuthenticatedAccount();
  if (!owner) throw new GitHubPublishError("--publish could not tell which GitHub account your token belongs to.");
  if (githubLogin && githubLogin.toLowerCase() !== owner.login.toLowerCase()) {
    throw new GitHubPublishError(`--publish writes to your own profile, but your GitHub token belongs to @${owner.login}, not @${githubLogin}.`);
  }
  return { client, login: owner.login };
}

async function publishToProfile(target: PublishTarget, cards: CardFile[], ui: Ui): Promise<void> {
  const publishing = ui.progress(`Publishing your cards to github.com/${target.login}/${target.login}`);
  try {
    const result = await publishCards(target.client, target.login, cards, CARD_FILES.full);
    const readmeNote = result.readmePath ? `, and added the player card to ${result.readmePath}` : "";
    publishing.done(result.committed ? `Published to ${result.repoUrl}${readmeNote}` : `Your cards on ${result.repoUrl} are already up to date`);
  } catch (error: unknown) {
    publishing.done("Could not publish your cards");
    throw error;
  }
}

async function run(argv: string[]): Promise<void> {
  const options = parseCliArgs(argv);
  if (options.help) {
    process.stderr.write(`${HELP_TEXT}\n`);
    return;
  }
  if (options.version) {
    process.stderr.write(`${await readVersion()}\n`);
    return;
  }

  const interactive = canPrompt(options.noInput);
  const ui = interactive ? promptUi() : plainUi();
  if (interactive) intro("gitquest · load your save file");

  const publishTarget = options.publish ? await resolvePublishTarget(options.github) : null;
  const [email, name] = await Promise.all([readGitConfig("user.email"), readGitConfig("user.name")]);
  const rawRoots = options.roots.length ? options.roots : options.github ? [] : interactive ? await askRoots() : ["."];
  const roots = rawRoots.map((root) => resolve(expandHome(root)));
  const localRepos = await findLocalRepos(roots, options.depth, ui);
  const github = options.github ? await syncGitHub(options.github, ui) : null;
  const mirrorRepos = github?.repoPaths ?? [];
  if (!localRepos.length && !mirrorRepos.length) {
    throw new NoReposFoundError([...roots.map(shortenHome), ...(options.github ? [`github.com/${options.github}`] : [])]);
  }
  const history = await readCommits(localRepos, mirrorRepos, ui);

  if (options.listEmails) {
    printEmailCounts(history.all);
    return;
  }

  const githubAccount = github?.source.account ?? null;
  const knownEmails = [...new Set([email, ...(githubAccount ? accountEmails(githubAccount) : [])].filter((known): known is string => known !== null))];
  // In GitHub mode the scanned account may not be the person running gitquest, so its name wins.
  const self = { email, name: githubAccount ? githubAccount.name ?? githubAccount.login : name };
  const emails = new Set(await chooseEmails(options, history.all, interactive, self, knownEmails));
  const mirrorCommits = await readMirrorStats(github, [...emails], ui);
  const mine = dedupeCommits([...history.local, ...mirrorCommits]).filter((commit) => emails.has(commit.authorEmail));
  if (!mine.length) {
    ui.warn(`No commits found for ${[...emails].join(", ")}.`);
    printEmailCounts(history.all);
    process.exitCode = 1;
    return;
  }

  const profile = buildProfile(options.player ?? self.name ?? userInfo().username, mine);
  const cards = renderCards(profile);
  const reportPath = await writeReport(profile, cards, resolve(expandHome(options.outDir)));
  const unlocked = profile.achievements.filter((achievement) => achievement.unlocked).length;
  const summary = `${profile.player} · Lv. ${profile.level.level} ${profile.className}\n${mine.length.toLocaleString("en-US")} commits · ${unlocked}/${profile.achievements.length} achievements unlocked`;
  ui.info(summary);
  if (publishTarget) await publishToProfile(publishTarget, cards, ui);

  if (interactive && (await askToOpen()) && (await openFile(reportPath))) {
    outro(`Report opened. It lives at ${shortenHome(reportPath)}`);
    return;
  }
  if (interactive) outro(`Your report is at ${shortenHome(reportPath)}`);
  else ui.info(`Report: ${reportPath}`);
}

run(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CancelledError) {
    cancel(error.message);
  } else if (error instanceof UsageError || error instanceof NoReposFoundError || error instanceof GitNotFoundError || error instanceof GitHubApiError) {
    process.stderr.write(`Error: ${error.message}\n`);
    if (error instanceof UsageError) process.stderr.write("Run gitquest --help for usage.\n");
  } else {
    process.stderr.write(`Unexpected error: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
});
