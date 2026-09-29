import { describe, expect, it, vi } from "vitest";
import { accountEmails, resolveGitHubSource } from "./account.js";
import type { GitHubAccount, GitHubClient, GitHubRepo } from "./api.js";

const ada: GitHubAccount = { login: "Ada", id: 42, name: "Ada Lovelace", email: null, createdAt: new Date("2020-01-01T00:00:00Z") };

function repo(fullName: string): GitHubRepo {
  const [owner = "", name = ""] = fullName.split("/");
  return { owner, name, fullName, cloneUrl: `https://github.com/${fullName}.git`, isPrivate: false, isFork: false, isUntouchedFork: false };
}

interface FakeRepos {
  owned?: GitHubRepo[];
  contributed?: GitHubRepo[];
  accessible?: GitHubRepo[];
  /** Full names of accessible repos that hold the account's commits. */
  committedTo?: string[];
}

function fakeClient(tokenOwner: GitHubAccount | null, repos: FakeRepos = {}): GitHubClient {
  const committedTo = new Set(repos.committedTo ?? []);
  return {
    isAuthenticated: tokenOwner !== null,
    getAuthenticatedAccount: vi.fn(async () => tokenOwner),
    getAccount: vi.fn(async (login: string) => ({ ...ada, login })),
    listOwnRepos: vi.fn(async () => repos.owned ?? []),
    listPublicRepos: vi.fn(async () => repos.owned ?? []),
    listContributedRepos: vi.fn(async () => repos.contributed ?? []),
    listAccessibleRepos: vi.fn(async () => repos.accessible ?? []),
    hasCommitsBy: vi.fn(async (checked: GitHubRepo) => committedTo.has(checked.fullName)),
  } as unknown as GitHubClient;
}

describe("resolveGitHubSource", () => {
  it("should include private repos when the token belongs to the account", async () => {
    const client = fakeClient(ada);
    const source = await resolveGitHubSource(client, "ada");
    expect(source.includesPrivate).toBe(true);
    expect(client.listOwnRepos).toHaveBeenCalled();
  });

  it("should keep org repos with the account's commits and drop the ones it only has access to", async () => {
    const client = fakeClient(ada, {
      owned: [repo("Ada/engine")],
      accessible: [repo("analytical/core"), repo("analytical/untouched")],
      committedTo: ["analytical/core"],
    });
    const source = await resolveGitHubSource(client, "ada");
    expect(source.repos.map((entry) => entry.fullName)).toEqual(["Ada/engine", "analytical/core"]);
    expect(source.ownedCount).toBe(1);
  });

  it("should skip forks nobody pushed to", async () => {
    const client = fakeClient(ada, { owned: [repo("Ada/engine"), { ...repo("Ada/javascript30"), isFork: true, isUntouchedFork: true }] });
    const source = await resolveGitHubSource(client, "ada");
    expect(source.repos.map((entry) => entry.fullName)).toEqual(["Ada/engine"]);
  });

  it("should add open source repos from the contribution graph, once each", async () => {
    const client = fakeClient(ada, { owned: [repo("Ada/engine")], contributed: [repo("ada/engine"), repo("babbage/difference")] });
    const source = await resolveGitHubSource(client, "ada");
    expect(source.repos.map((entry) => entry.fullName)).toEqual(["Ada/engine", "babbage/difference"]);
  });

  it("should not check repos the contribution graph already found", async () => {
    const client = fakeClient(ada, { contributed: [repo("analytical/core")], accessible: [repo("analytical/core")] });
    await resolveGitHubSource(client, "ada");
    expect(client.hasCommitsBy).not.toHaveBeenCalled();
  });

  it("should look at contributions since the day the account was created", async () => {
    const client = fakeClient(ada);
    await resolveGitHubSource(client, "ada");
    expect(client.listContributedRepos).toHaveBeenCalledWith("Ada", ada.createdAt);
  });

  it("should fall back to public repos when the token belongs to someone else", async () => {
    const client = fakeClient({ ...ada, login: "grace" });
    const source = await resolveGitHubSource(client, "ada");
    expect(source.includesPrivate).toBe(false);
    expect(client.listPublicRepos).toHaveBeenCalledWith("ada");
    expect(client.listAccessibleRepos).not.toHaveBeenCalled();
  });

  it("should only use public owned repos without a token", async () => {
    const client = fakeClient(null);
    const source = await resolveGitHubSource(client, "ada");
    expect(source.includesPrivate).toBe(false);
    expect(client.listContributedRepos).not.toHaveBeenCalled();
  });
});

describe("accountEmails", () => {
  it("should list both noreply formats in lowercase", () => {
    expect(accountEmails(ada)).toEqual(["42+ada@users.noreply.github.com", "ada@users.noreply.github.com"]);
  });

  it("should put the public profile email first when there is one", () => {
    expect(accountEmails({ ...ada, email: "ada@personal.dev" })[0]).toBe("ada@personal.dev");
  });
});
