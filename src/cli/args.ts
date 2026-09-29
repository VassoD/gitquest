import { parseArgs } from "node:util";

export class UsageError extends Error {
  override name = "UsageError";
}

export interface CliOptions {
  /** Empty when the user passed no folder, so the interactive flow can ask. */
  roots: string[];
  /** GitHub login whose repos get cloned and scanned, on top of any local folders. */
  github: string | null;
  emails: string[];
  player: string | null;
  outDir: string;
  depth: number;
  listEmails: boolean;
  noInput: boolean;
  help: boolean;
  version: boolean;
}

export const DEFAULT_OUT_DIR = "gitquest-report";
const DEFAULT_DEPTH = 4;
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export const HELP_TEXT = `gitquest: turn your git history into an RPG save file

Usage
  gitquest [folders...] [options]

  Run it with no options and it asks you where your repos are and which
  emails are yours. It then writes an HTML report plus SVG cards for your
  GitHub profile README. Nothing leaves your machine.

Options
  -g, --github <user>   Scan every repo of a GitHub account. Repos are cloned
                        into ~/.cache/gitquest, without the files your
                        commits did not touch. Private and org repos are
                        included when GITHUB_TOKEN (or \`gh auth login\`)
                        belongs to that account.
  -e, --email <email>   An email you commit with. Repeat for each one.
                        Skips the email picker.
  -n, --name <name>     Player name shown on the report.
  -o, --out <folder>    Where to write the report (default: ${DEFAULT_OUT_DIR}).
  -d, --depth <n>       How deep to look for repos (default: ${DEFAULT_DEPTH}).
      --list-emails     List every author email found, to spot your old ones.
      --no-input        Never prompt. Uses the current folder and your
                        global git user.email unless you pass them.
  -h, --help            Show this help.
  -v, --version         Show the version.

Examples
  gitquest
  gitquest ~/code
  gitquest ~/code ~/work -e me@personal.dev -e me@company.com
  gitquest ~/code --list-emails
  gitquest --github octocat
  gitquest ~/code --github octocat`;

export function parseCliArgs(argv: string[]): CliOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        github: { type: "string", short: "g" },
        email: { type: "string", short: "e", multiple: true },
        name: { type: "string", short: "n" },
        out: { type: "string", short: "o" },
        depth: { type: "string", short: "d" },
        "list-emails": { type: "boolean" },
        "no-input": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error: unknown) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }

  const { values, positionals } = parsed;
  const depth = values.depth === undefined ? DEFAULT_DEPTH : Number(values.depth);
  if (!Number.isInteger(depth) || depth < 0) throw new UsageError("--depth must be a whole number, like 3.");
  const github = values.github?.trim().replace(/^@/, "") || null;
  if (github !== null && !GITHUB_LOGIN.test(github)) throw new UsageError(`"${values.github}" is not a GitHub username.`);

  return {
    roots: positionals,
    github,
    emails: (values.email ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean),
    player: values.name?.trim() || null,
    outDir: values.out ?? DEFAULT_OUT_DIR,
    depth,
    listEmails: values["list-emails"] ?? false,
    noInput: values["no-input"] ?? false,
    help: values.help ?? false,
    version: values.version ?? false,
  };
}
