#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { join, resolve } from "node:path";
import { cancel, intro, log as clackLog, outro, spinner } from "@clack/prompts";
import { buildProfile } from "../analyze/build-profile.js";
import type { Profile } from "../analyze/types.js";
import { collectAuthors, suggestOwnEmails } from "../identity/authors.js";
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
import { expandHome, shortenHome } from "./paths.js";

const TOP_EMAILS_SHOWN = 20;

/** Plain output for --no-input and piped runs, prompt-styled output otherwise. */
interface Ui {
  info: (message: string) => void;
  warn: (message: string) => void;
  progress: (message: string) => { update: (message: string) => void; done: (message: string) => void };
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
      return { update: () => undefined, done: write };
    },
  };
}

function promptUi(): Ui {
  return {
    info: (message) => clackLog.info(message),
    warn: (message) => clackLog.warn(message),
    progress: (message) => {
      const indicator = spinner();
      indicator.start(message);
      return { update: (next) => indicator.message(next), done: (final) => indicator.stop(final) };
    },
  };
}

async function readVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };
  return packageJson.version ?? "unknown";
}

async function scan(roots: string[], depth: number, ui: Ui): Promise<Commit[]> {
  const search = ui.progress(`Looking for repos in ${roots.map(shortenHome).join(", ")}`);
  const repoPaths = await findRepos(roots, depth);
  if (!repoPaths.length) {
    search.done("No repos found");
    throw new NoReposFoundError(roots.map(shortenHome));
  }
  search.done(`Found ${repoPaths.length} ${repoPaths.length === 1 ? "repo" : "repos"}`);

  const reading = ui.progress("Reading your history");
  const results = await readAllCommits(repoPaths, (done, total) => reading.update(`Reading your history (${done}/${total} repos)`));
  const commits = dedupeCommits(results.flatMap((result) => result.commits));
  reading.done(`Read ${commits.length.toLocaleString("en-US")} commits`);
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

async function chooseEmails(options: CliOptions, commits: Commit[], interactive: boolean, self: { email: string | null; name: string | null }): Promise<string[]> {
  if (options.emails.length) return options.emails;
  const authors = collectAuthors(commits);
  if (interactive) return pickEmails(authors, suggestOwnEmails(authors, self));
  if (!self.email) throw new UsageError("No email to match commits against. Pass one with --email you@example.com.");
  return [self.email];
}

async function writeReport(profile: Profile, outDir: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const reportPath = join(outDir, "index.html");
  await Promise.all([
    writeFile(reportPath, renderReport(profile)),
    writeFile(join(outDir, CARD_FILES.full), renderPlayerCard(profile)),
    writeFile(join(outDir, CARD_FILES.badges), renderAchievementStrip(profile)),
    writeFile(join(outDir, CARD_FILES.mini), renderMiniBadge(profile)),
  ]);
  return reportPath;
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

  const [email, name] = await Promise.all([readGitConfig("user.email"), readGitConfig("user.name")]);
  const rawRoots = options.roots.length ? options.roots : interactive ? await askRoots() : ["."];
  const roots = rawRoots.map((root) => resolve(expandHome(root)));
  const commits = await scan(roots, options.depth, ui);

  if (options.listEmails) {
    printEmailCounts(commits);
    return;
  }

  const emails = new Set(await chooseEmails(options, commits, interactive, { email, name }));
  const mine = commits.filter((commit) => emails.has(commit.authorEmail));
  if (!mine.length) {
    ui.warn(`No commits found for ${[...emails].join(", ")}.`);
    printEmailCounts(commits);
    process.exitCode = 1;
    return;
  }

  const profile = buildProfile(options.player ?? name ?? userInfo().username, mine);
  const reportPath = await writeReport(profile, resolve(expandHome(options.outDir)));
  const unlocked = profile.achievements.filter((achievement) => achievement.unlocked).length;
  const summary = `${profile.player} · Lv. ${profile.level.level} ${profile.className}\n${mine.length.toLocaleString("en-US")} commits · ${unlocked}/${profile.achievements.length} achievements unlocked`;
  ui.info(summary);

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
  } else if (error instanceof UsageError || error instanceof NoReposFoundError || error instanceof GitNotFoundError) {
    process.stderr.write(`Error: ${error.message}\n`);
    if (error instanceof UsageError) process.stderr.write("Run gitquest --help for usage.\n");
  } else {
    process.stderr.write(`Unexpected error: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
});
