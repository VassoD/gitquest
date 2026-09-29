import type { Commit, FileChange } from "../scan/types.js";
import { isNoisePath } from "./languages.js";

/** A commit that adds this many brand new files at once is almost always imported or generated code. */
const IMPORT_MIN_NEW_FILES = 50;
const IMPORT_NEW_FILE_SHARE = 0.8;
/** Imported code still counts a little: you chose it and you own it now. */
export const IMPORT_LINE_WEIGHT = 0.1;

export function meaningfulFiles(commit: Commit): FileChange[] {
  return commit.files.filter((file) => !isNoisePath(file.path));
}

/** Initial commits, scaffolds and code moved in from another tool. */
export function isImportCommit(commit: Commit): boolean {
  const created = commit.createdPaths.filter((path) => !isNoisePath(path)).length;
  const files = meaningfulFiles(commit).length;
  return created >= IMPORT_MIN_NEW_FILES && created / Math.max(files, 1) >= IMPORT_NEW_FILE_SHARE;
}

export function lineWeight(commit: Commit): number {
  return isImportCommit(commit) ? IMPORT_LINE_WEIGHT : 1;
}

/**
 * Existing files a commit changed. New files are not a refactor,
 * and pure deletions are cleanup, which Code Janitor already rewards.
 */
export function editedFileCount(commit: Commit): number {
  const created = new Set(commit.createdPaths);
  return meaningfulFiles(commit).filter((file) => file.added > 0 && !created.has(file.path)).length;
}
