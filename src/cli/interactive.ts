import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { confirm, isCancel, multiselect, text } from "@clack/prompts";
import type { AuthorIdentity } from "../identity/authors.js";
import { expandHome, shortenHome } from "./paths.js";

export class CancelledError extends Error {
  override name = "CancelledError";
  constructor() {
    super("Cancelled. Your save file is safe.");
  }
}

const EMAIL_PICKER_ROWS = 12;
const EMAIL_PICKER_LIMIT = 60;

function unwrap<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) throw new CancelledError();
  return value as Exclude<T, symbol>;
}

export function canPrompt(noInput: boolean): boolean {
  return !noInput && Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

export async function askRoots(): Promise<string[]> {
  const answer = unwrap(
    await text({
      message: "Where do you keep your repos? (separate several folders with commas)",
      placeholder: "~/code",
      initialValue: shortenHome(process.cwd()),
      validate: (value) => {
        const folders = (value ?? "").split(",").map((folder) => folder.trim()).filter(Boolean);
        if (!folders.length) return "Enter at least one folder.";
        const missing = folders.find((folder) => {
          const path = resolve(expandHome(folder));
          return !existsSync(path) || !statSync(path).isDirectory();
        });
        return missing ? `${missing} is not a folder.` : undefined;
      },
    }),
  );
  return answer.split(",").map((folder) => folder.trim()).filter(Boolean);
}

function describeAuthor(author: AuthorIdentity): string {
  const commits = `${author.commits.toLocaleString("en-US")} ${author.commits === 1 ? "commit" : "commits"}`;
  const repos = `${author.repos} ${author.repos === 1 ? "repo" : "repos"}`;
  const names = author.names.slice(0, 2).join(", ");
  return [names, commits, repos].filter(Boolean).join(" · ");
}

export async function pickEmails(authors: AuthorIdentity[], suggested: string[]): Promise<string[]> {
  const suggestedSet = new Set(suggested);
  // Suggested emails first, so the likely ones are visible without scrolling.
  const ordered = [
    ...authors.filter((author) => suggestedSet.has(author.email)),
    ...authors.filter((author) => !suggestedSet.has(author.email)),
  ].slice(0, EMAIL_PICKER_LIMIT);

  return unwrap(
    await multiselect({
      message: suggested.length
        ? "Which emails are yours? We ticked the ones that look like you."
        : "Which emails are yours? Tick every one you have committed with.",
      options: ordered.map((author) => ({ value: author.email, label: author.email, hint: describeAuthor(author) })),
      initialValues: suggested,
      maxItems: EMAIL_PICKER_ROWS,
      required: true,
    }),
  );
}

export async function askToOpen(): Promise<boolean> {
  return unwrap(await confirm({ message: "Open your report now?", initialValue: true }));
}
