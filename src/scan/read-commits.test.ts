import { describe, expect, it } from "vitest";
import { makeCommit } from "../test-helpers.js";
import { dedupeCommits } from "./read-commits.js";

describe("dedupeCommits", () => {
  it("should keep one copy of a commit found in two clones", () => {
    const commit = makeCommit("2025-07-30");
    expect(dedupeCommits([commit, { ...commit, repo: "fork" }])).toHaveLength(1);
  });

  it("should keep one copy of a rebased commit with a new hash", () => {
    const original = makeCommit("2025-07-30", { subject: "refactor: rename folders" });
    expect(dedupeCommits([original, { ...original, hash: "rebased" }])).toHaveLength(1);
  });

  it("should keep different commits made at the same time", () => {
    const first = makeCommit("2025-07-30", { subject: "feat: a" });
    const second = makeCommit("2025-07-30", { subject: "feat: b" });
    expect(dedupeCommits([first, second])).toHaveLength(2);
  });
});
