import { describe, expect, it } from "vitest";
import { FIELD_SEPARATOR as F, parseGitLog, RECORD_SEPARATOR as R, resolveRenamedPath } from "./parse-git-log.js";

describe("parseGitLog", () => {
  const output = [
    `${R}abc123${F}Me@Example.com${F}2021-03-14T01:30:00+02:00${F}feat: add login`,
    "12\t3\tsrc/login.ts",
    "-\t-\tassets/logo.png",
    " create mode 100644 src/login.test.ts",
    "",
    `${R}def456${F}me@example.com${F}2021-03-15T10:00:00-05:00${F}fix: typo`,
    "1\t1\tREADME.md",
  ].join("\n");

  it("should parse every commit with its files", () => {
    const commits = parseGitLog(output, "my-repo");
    expect(commits).toHaveLength(2);
    expect(commits[0]?.files).toEqual([
      { path: "src/login.ts", added: 12, deleted: 3, isBinary: false },
      { path: "assets/logo.png", added: 0, deleted: 0, isBinary: true },
    ]);
    expect(commits[0]?.repo).toBe("my-repo");
  });

  it("should keep the author's local hour and date instead of UTC", () => {
    const [first] = parseGitLog(output, "my-repo");
    expect(first?.localHour).toBe(1);
    expect(first?.localDate).toBe("2021-03-14");
    expect(first?.authoredAt.toISOString()).toBe("2021-03-13T23:30:00.000Z");
  });

  it("should lowercase emails so identities match", () => {
    expect(parseGitLog(output, "r")[0]?.authorEmail).toBe("me@example.com");
  });

  it("should record created files from the summary", () => {
    expect(parseGitLog(output, "r")[0]?.createdPaths).toEqual(["src/login.test.ts"]);
  });

  it("should skip records with a broken header", () => {
    expect(parseGitLog(`${R}onlyhash\n1\t1\ta.ts`, "r")).toEqual([]);
  });
});

describe("resolveRenamedPath", () => {
  it("should resolve braced renames", () => {
    expect(resolveRenamedPath("src/{old => new}/file.ts")).toBe("src/new/file.ts");
  });

  it("should resolve braced renames that remove a folder", () => {
    expect(resolveRenamedPath("src/{legacy => }/file.ts")).toBe("src/file.ts");
  });

  it("should resolve plain renames", () => {
    expect(resolveRenamedPath("a.ts => b.ts")).toBe("b.ts");
  });
});
