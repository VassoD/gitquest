#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { join, resolve } from "node:path";
import { buildProfile } from "../analyze/build-profile.js";
import { renderAchievementStrip, renderMiniBadge, renderPlayerCard } from "../report/cards.js";
import { CARD_FILES, renderReport } from "../report/html.js";
import { GitCommandError, GitNotFoundError, NoReposFoundError } from "../scan/errors.js";
import { findRepos } from "../scan/find-repos.js";
import { readGlobalEmail, runGit } from "../scan/git.js";
import { dedupeCommits, readAllCommits } from "../scan/read-commits.js";
import type { Commit } from "../scan/types.js";
import { HELP_TEXT, parseCliArgs, UsageError, type CliOptions } from "./args.js";

const TOP_EMAILS_SHOWN = 20;

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

async function readVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };
  return packageJson.version ?? "unknown";
}

async function resolveEmails(options: CliOptions): Promise<string[]> {
  if (options.emails.length) return options.emails;
  const globalEmail = await readGlobalEmail();
  if (!globalEmail) throw new UsageError("No email to match commits against. Pass one with --email you@example.com.");
  return [globalEmail];
}

async function resolvePlayer(options: CliOptions): Promise<string> {
  if (options.player) return options.player;
  try {
    const name = (await runGit(process.cwd(), ["config", "--global", "user.name"])).trim();
    if (name) return name;
  } catch {
    // Fall back to the OS user below.
  }
  return userInfo().username;
}

function printEmailCounts(commits: Commit[]): void {
  const counts = new Map<string, number>();
  for (const commit of commits) counts.set(commit.authorEmail, (counts.get(commit.authorEmail) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_EMAILS_SHOWN);
  log("\nAuthor emails found (commits):");
  for (const [email, count] of sorted) log(`  ${String(count).padStart(7)}  ${email}`);
  log("\nPass the ones that are you with -e, for example: gitquest ~/code -e a@x.com -e b@y.com");
}

async function run(argv: string[]): Promise<void> {
  const options = parseCliArgs(argv);
  if (options.help) {
    log(HELP_TEXT);
    return;
  }
  if (options.version) {
    log(await readVersion());
    return;
  }

  const roots = options.roots.map((root) => resolve(root));
  log(`Searching for repos in ${roots.join(", ")}...`);
  const repoPaths = await findRepos(roots, options.depth);
  if (!repoPaths.length) throw new NoReposFoundError(roots);
  log(`Found ${repoPaths.length} repos. Reading history...`);

  const showProgress = process.stderr.isTTY;
  const results = await readAllCommits(repoPaths, (done, total) => {
    if (showProgress) process.stderr.write(`\r  ${done}/${total} repos read`);
  });
  if (showProgress) process.stderr.write("\n");
  for (const failed of results.filter((result) => result.error)) {
    log(`  Skipped ${failed.repoPath}: ${failed.error instanceof GitCommandError ? failed.error.stderr.trim().split("\n")[0] : failed.error?.message}`);
  }
  const allCommits = dedupeCommits(results.flatMap((result) => result.commits));

  if (options.listEmails) {
    printEmailCounts(allCommits);
    return;
  }

  const emails = new Set(await resolveEmails(options));
  const mine = allCommits.filter((commit) => emails.has(commit.authorEmail));
  if (!mine.length) {
    log(`No commits found for ${[...emails].join(", ")}.`);
    printEmailCounts(allCommits);
    process.exitCode = 1;
    return;
  }

  const profile = buildProfile(await resolvePlayer(options), mine);
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(join(outDir, "index.html"), renderReport(profile)),
    writeFile(join(outDir, CARD_FILES.full), renderPlayerCard(profile)),
    writeFile(join(outDir, CARD_FILES.badges), renderAchievementStrip(profile)),
    writeFile(join(outDir, CARD_FILES.mini), renderMiniBadge(profile)),
  ]);

  const unlocked = profile.achievements.filter((achievement) => achievement.unlocked).length;
  log(`\n${profile.player} · Lv. ${profile.level.level} ${profile.className}`);
  log(`${mine.length.toLocaleString("en-US")} commits · ${unlocked}/${profile.achievements.length} achievements unlocked`);
  log(`\nReport: ${join(outDir, "index.html")}`);
}

run(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof UsageError || error instanceof NoReposFoundError || error instanceof GitNotFoundError) {
    log(`Error: ${error.message}`);
    if (error instanceof UsageError) log("Run gitquest --help for usage.");
  } else {
    log(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exitCode = 1;
});
