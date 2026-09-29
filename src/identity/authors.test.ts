import { describe, expect, it } from "vitest";
import { makeCommit } from "../test-helpers.js";
import { collectAuthors, suggestOwnEmails } from "./authors.js";

const commits = [
  makeCommit("2021-01-01", { authorEmail: "ada@personal.dev", authorName: "Ada Lovelace", repo: "a" }),
  makeCommit("2021-01-02", { authorEmail: "ada@personal.dev", authorName: "Ada Lovelace", repo: "b" }),
  makeCommit("2022-01-01", { authorEmail: "a.lovelace@work.com", authorName: "Ada Lovelace" }),
  makeCommit("2022-02-01", { authorEmail: "123+ada@users.noreply.github.com", authorName: "ada" }),
  makeCommit("2022-03-01", { authorEmail: "grace@navy.mil", authorName: "Grace Hopper" }),
];

describe("collectAuthors", () => {
  it("should group by email with commit and repo counts, busiest first", () => {
    const [first] = collectAuthors(commits);
    expect(first).toEqual({ email: "ada@personal.dev", names: ["Ada Lovelace"], commits: 2, repos: 2 });
  });
});

describe("suggestOwnEmails", () => {
  const authors = collectAuthors(commits);

  it("should match by email, author name and GitHub noreply username", () => {
    const suggested = suggestOwnEmails(authors, { email: "ada@personal.dev", name: "Ada Lovelace" });
    expect(suggested.sort()).toEqual(["123+ada@users.noreply.github.com", "a.lovelace@work.com", "ada@personal.dev"]);
  });

  it("should not pick up other contributors", () => {
    expect(suggestOwnEmails(authors, { email: "ada@personal.dev", name: "Ada Lovelace" })).not.toContain("grace@navy.mil");
  });

  it("should suggest nothing when git config is empty", () => {
    expect(suggestOwnEmails(authors, { email: null, name: null })).toEqual([]);
  });
});
