import { describe, expect, it } from "vitest";
import { makeCommit } from "../test-helpers.js";
import { editedFileCount, isImportCommit, lineWeight } from "./commit-weight.js";
import { computeStats } from "./stats.js";

const manyFiles = (count: number, prefix: string): { path: string; added: number }[] =>
  Array.from({ length: count }, (_, index) => ({ path: `${prefix}/file${index}.ts`, added: 100 }));

describe("isImportCommit", () => {
  it("should flag a commit that creates 50+ new files at once", () => {
    const files = manyFiles(60, "src");
    const commit = makeCommit("2025-01-01", { createdPaths: files.map((file) => file.path) }, files);
    expect(isImportCommit(commit)).toBe(true);
    expect(lineWeight(commit)).toBeLessThan(1);
    expect(editedFileCount(commit)).toBe(0);
  });

  it("should not flag a large refactor that edits existing files", () => {
    const commit = makeCommit("2025-01-01", {}, manyFiles(120, "src"));
    expect(isImportCommit(commit)).toBe(false);
    expect(editedFileCount(commit)).toBe(120);
  });
});

describe("editedFileCount", () => {
  it("should not count brand new files, even in a small first commit", () => {
    const files = manyFiles(40, "src");
    expect(editedFileCount(makeCommit("2025-01-01", { createdPaths: files.map((file) => file.path) }, files))).toBe(0);
  });

  it("should ignore log files and pure deletions", () => {
    const commit = makeCommit("2025-02-28", {}, [
      ...Array.from({ length: 300 }, (_, index) => ({ path: `logs/run${index}.log`, added: 0, deleted: 50 })),
      ...Array.from({ length: 50 }, (_, index) => ({ path: `src/old${index}.ts`, added: 0, deleted: 20 })),
      { path: "src/app.ts", added: 3, deleted: 1 },
    ]);
    expect(editedFileCount(commit)).toBe(1);
  });
});

describe("computeStats with imports", () => {
  it("should count imported lines at a reduced weight", () => {
    const files = manyFiles(100, "app");
    const imported = makeCommit("2025-01-01", { createdPaths: files.map((file) => file.path) }, files);
    const handWritten = makeCommit("2025-01-02", {}, [{ path: "app/feature.ts", added: 500 }]);
    expect(computeStats([imported, handWritten]).added).toBe(1_000 + 500);
  });
});
