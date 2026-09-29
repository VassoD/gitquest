import type { Commit, FileChange } from "./scan/types.js";

let counter = 0;

/** Builds a commit authored at local noon on `localDate` unless overridden. */
export function makeCommit(localDate: string, overrides: Partial<Commit> = {}, files: Partial<FileChange>[] = []): Commit {
  counter += 1;
  return {
    hash: `hash${counter}`,
    repo: "repo",
    authorEmail: "me@example.com",
    authoredAt: new Date(`${localDate}T12:00:00Z`),
    localDate,
    localHour: 12,
    localWeekday: new Date(`${localDate}T00:00:00Z`).getUTCDay(),
    subject: "update",
    files: files.map((file) => ({ path: "src/index.ts", added: 10, deleted: 0, isBinary: false, ...file })),
    createdPaths: [],
    ...overrides,
  };
}
