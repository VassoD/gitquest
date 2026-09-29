import { parseArgs } from "node:util";

export class UsageError extends Error {
  override name = "UsageError";
}

export interface CliOptions {
  roots: string[];
  emails: string[];
  player: string | null;
  outDir: string;
  depth: number;
  listEmails: boolean;
  help: boolean;
  version: boolean;
}

export const DEFAULT_OUT_DIR = "gitquest-report";
const DEFAULT_DEPTH = 4;

export const HELP_TEXT = `gitquest: turn your git history into an RPG save file

Usage
  gitquest [folders...] [options]

  Scans every git repo under the given folders (default: current folder),
  keeps the commits you authored, and writes an HTML report plus SVG cards
  for your GitHub profile README. Nothing leaves your machine.

Options
  -e, --email <email>   An email you commit with. Repeat for each one.
                        Defaults to your global git user.email.
  -n, --name <name>     Player name shown on the report.
  -o, --out <folder>    Where to write the report (default: ${DEFAULT_OUT_DIR}).
  -d, --depth <n>       How deep to look for repos (default: ${DEFAULT_DEPTH}).
      --list-emails     List every author email found, to spot your old ones.
  -h, --help            Show this help.
  -v, --version         Show the version.

Examples
  gitquest ~/code
  gitquest ~/code ~/work -e me@personal.dev -e me@company.com
  gitquest ~/code --list-emails`;

export function parseCliArgs(argv: string[]): CliOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        email: { type: "string", short: "e", multiple: true },
        name: { type: "string", short: "n" },
        out: { type: "string", short: "o" },
        depth: { type: "string", short: "d" },
        "list-emails": { type: "boolean" },
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

  return {
    roots: positionals.length ? positionals : ["."],
    emails: (values.email ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean),
    player: values.name?.trim() || null,
    outDir: values.out ?? DEFAULT_OUT_DIR,
    depth,
    listEmails: values["list-emails"] ?? false,
    help: values.help ?? false,
    version: values.version ?? false,
  };
}
