import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitHubRepo } from "./api.js";
import { defaultCacheDir, gitAuthEnv, mirrorPath, readMirrorCommits, syncMirrors, transportUrl } from "./mirror.js";

function git(cwd: string, ...args: string[]): string {
  return gitAs("Ada", "ada@example.com", cwd, ...args);
}

function gitAs(name: string, email: string, cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email },
  });
}

/** Objects the mirror knows about but has not downloaded. */
function missingObjects(repoPath: string): string[] {
  return git(repoPath, "rev-list", "--objects", "--missing=print", "--branches").split("\n").filter((line) => line.startsWith("?"));
}

describe("syncMirrors", () => {
  let workDir: string;
  let upstream: string;
  let cacheDir: string;
  let repo: GitHubRepo;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "gitquest-mirror-"));
    upstream = join(workDir, "upstream");
    cacheDir = join(workDir, "cache");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", upstream]);
    // Like GitHub, let clients skip file contents and fetch single files by id.
    git(upstream, "config", "uploadpack.allowFilter", "true");
    git(upstream, "config", "uploadpack.allowAnySHA1InWant", "true");
    git(upstream, "commit", "--allow-empty", "--quiet", "-m", "first");
    // git ignores --filter for plain local paths, a file:// URL behaves like a remote.
    repo = { owner: "ada", name: "quest", fullName: "ada/quest", cloneUrl: `file://${upstream}`, isPrivate: false, isFork: false, isUntouchedFork: false };
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("should clone a new repo as a bare copy", async () => {
    const [result] = await syncMirrors([repo], cacheDir, null);
    expect(result?.error).toBeUndefined();
    expect(result?.path).toBe(mirrorPath(cacheDir, repo));
    expect(git(mirrorPath(cacheDir, repo), "log", "--branches", "--format=%s")).toBe("first\n");
  });

  it("should fetch new commits on the next run", async () => {
    await syncMirrors([repo], cacheDir, null);
    git(upstream, "commit", "--allow-empty", "--quiet", "-m", "second");
    await syncMirrors([repo], cacheDir, null);
    expect(git(mirrorPath(cacheDir, repo), "log", "--branches", "--format=%s")).toBe("second\nfirst\n");
  });

  it("should keep the old copy when a fetch fails", async () => {
    await syncMirrors([repo], cacheDir, null);
    const [result] = await syncMirrors([{ ...repo, cloneUrl: join(workDir, "missing") }], cacheDir, null);
    expect(result?.error).toBeInstanceOf(Error);
    expect(result?.path).toBe(mirrorPath(cacheDir, repo));
  });

  it("should leave nothing behind when a first clone fails", async () => {
    const [result] = await syncMirrors([{ ...repo, cloneUrl: join(workDir, "missing") }], cacheDir, null);
    expect(result?.path).toBeNull();
    expect(existsSync(mirrorPath(cacheDir, repo))).toBe(false);
  });

  it("should clone without file contents", async () => {
    await writeFile(join(upstream, "notes.txt"), "hello\n");
    git(upstream, "add", "notes.txt");
    git(upstream, "commit", "--quiet", "-m", "notes");
    await syncMirrors([repo], cacheDir, null);
    expect(missingObjects(mirrorPath(cacheDir, repo))).toHaveLength(1);
  });

  it("should replace a full clone made by an older version", async () => {
    const target = mirrorPath(cacheDir, repo);
    execFileSync("git", ["clone", "--bare", "--quiet", upstream, target]);
    const [result] = await syncMirrors([repo], cacheDir, null);
    expect(result?.error).toBeUndefined();
    expect(git(target, "config", "--get", "gitquest.layout")).toBe("blobless\n");
  });

  it("should not write the token into the clone's config", async () => {
    await syncMirrors([repo], cacheDir, "secret-token");
    const config = await readFile(join(mirrorPath(cacheDir, repo), "config"), "utf8");
    expect(config).not.toContain("secret-token");
    expect(config).not.toContain(Buffer.from("x-access-token:secret-token").toString("base64"));
  });
});

function gitSettings(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const count = Number(env.GIT_CONFIG_COUNT ?? "0");
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [env[`GIT_CONFIG_KEY_${index}`], env[`GIT_CONFIG_VALUE_${index}`]]));
}

describe("gitAuthEnv", () => {
  it("should never prompt for credentials or ask the keychain", () => {
    const env = gitAuthEnv(null);
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
    expect(gitSettings(env)["credential.helper"]).toBe("");
  });

  it("should abort stalled transfers", () => {
    expect(gitSettings(gitAuthEnv(null))).toMatchObject({ "http.lowSpeedLimit": "1000", "http.lowSpeedTime": "60" });
  });

  it("should pass the token as a basic auth header", () => {
    const header = gitSettings(gitAuthEnv("secret"))["http.extraHeader"];
    expect(header).toBe(`Authorization: Basic ${Buffer.from("x-access-token:secret").toString("base64")}`);
  });

  it("should not add an auth header without a token", () => {
    expect(gitSettings(gitAuthEnv(null))).not.toHaveProperty("http.extraHeader");
  });
});

describe("transportUrl", () => {
  it("should dodge insteadOf rules that rewrite GitHub HTTPS URLs to SSH", () => {
    expect(transportUrl("https://github.com/ada/quest.git")).toBe("https://gitquest@github.com/ada/quest.git");
  });

  it("should leave other URLs alone", () => {
    expect(transportUrl("/tmp/upstream")).toBe("/tmp/upstream");
  });
});

describe("defaultCacheDir", () => {
  it("should respect XDG_CACHE_HOME", () => {
    expect(defaultCacheDir({ XDG_CACHE_HOME: "/tmp/xdg" })).toBe("/tmp/xdg/gitquest/github");
  });
});

describe("readMirrorCommits", () => {
  let workDir: string;
  let upstream: string;
  let cacheDir: string;
  let repo: GitHubRepo;

  async function commitFile(name: string, email: string, path: string, content: string): Promise<void> {
    await writeFile(join(upstream, path), content);
    gitAs(name, email, upstream, "add", path);
    gitAs(name, email, upstream, "commit", "--quiet", "-m", `add ${path}`);
  }

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "gitquest-mirror-read-"));
    upstream = join(workDir, "upstream");
    cacheDir = join(workDir, "cache");
    execFileSync("git", ["init", "--quiet", "--initial-branch=main", upstream]);
    git(upstream, "config", "uploadpack.allowFilter", "true");
    git(upstream, "config", "uploadpack.allowAnySHA1InWant", "true");
    await commitFile("Ada", "ada@example.com", "ada.txt", "one\ntwo\n");
    await commitFile("Bob", "bob@example.com", "bob.txt", "a\nb\nc\n");
    await commitFile("Bada", "bada@example.com", "bada.txt", "x\n");
    repo = { owner: "ada", name: "quest", fullName: "ada/quest", cloneUrl: `file://${upstream}`, isPrivate: false, isFork: false, isUntouchedFork: false };
    await syncMirrors([repo], cacheDir, null);
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("should read only the chosen emails' commits, with line stats", async () => {
    const [result] = await readMirrorCommits([mirrorPath(cacheDir, repo)], ["ada@example.com"], null);
    expect(result?.error).toBeUndefined();
    expect(result?.commits.map((commit) => commit.authorEmail)).toEqual(["ada@example.com"]);
    expect(result?.commits[0]?.files).toEqual([{ path: "ada.txt", added: 2, deleted: 0, isBinary: false }]);
  });

  it("should match emails ignoring case", async () => {
    const [result] = await readMirrorCommits([mirrorPath(cacheDir, repo)], ["ADA@example.com"], null);
    expect(result?.commits).toHaveLength(1);
  });

  it("should download only the files the chosen emails touched", async () => {
    const mirror = mirrorPath(cacheDir, repo);
    expect(missingObjects(mirror)).toHaveLength(3);
    await readMirrorCommits([mirror], ["ada@example.com"], null);
    expect(missingObjects(mirror)).toHaveLength(2);
  });
});
