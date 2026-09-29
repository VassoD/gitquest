import { describe, expect, it, vi } from "vitest";
import { GitHubClient, parseRepo, yearWindows, type GitHubRepo } from "./api.js";
import { GitHubAuthError, GitHubRateLimitError, GitHubUserNotFoundError } from "./errors.js";

function repoJson(name: string, owner = "ada"): Record<string, unknown> {
  return { name, full_name: `${owner}/${name}`, owner: { login: owner }, clone_url: `https://github.com/${owner}/${name}.git`, private: false, fork: false };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function clientWith(responses: Response[], token: string | null = "secret"): { client: GitHubClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  return { client: new GitHubClient({ token, fetchImpl: fetchMock, retryDelayMs: 0 }), fetchMock };
}

describe("parseRepo", () => {
  it("should map the fields gitquest needs", () => {
    expect(parseRepo({ ...repoJson("quest"), private: true })).toEqual({
      owner: "ada",
      name: "quest",
      fullName: "ada/quest",
      cloneUrl: "https://github.com/ada/quest.git",
      isPrivate: true,
      isFork: false,
      isUntouchedFork: false,
    });
  });

  it("should flag a fork nobody pushed to after forking", () => {
    const fork = { ...repoJson("quest"), fork: true, created_at: "2024-05-01T10:00:00Z" };
    expect(parseRepo({ ...fork, pushed_at: "2023-01-01T00:00:00Z" })?.isUntouchedFork).toBe(true);
    expect(parseRepo({ ...fork, pushed_at: "2024-06-01T00:00:00Z" })?.isUntouchedFork).toBe(false);
  });

  it("should reject names that could escape the cache folder", () => {
    expect(parseRepo(repoJson(".."))).toBeNull();
    expect(parseRepo(repoJson("a/b"))).toBeNull();
  });

  it("should build the clone URL when search results leave it out", () => {
    const { clone_url: _omitted, ...searchResult } = repoJson("quest");
    expect(parseRepo(searchResult)?.cloneUrl).toBe("https://github.com/ada/quest.git");
  });

  it("should reject malformed entries", () => {
    expect(parseRepo({ name: "quest" })).toBeNull();
    expect(parseRepo(null)).toBeNull();
  });
});

describe("GitHubClient", () => {
  it("should follow pages until one comes back short", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => repoJson(`repo-${index}`));
    const { client, fetchMock } = clientWith([jsonResponse(fullPage), jsonResponse([repoJson("last")])]);

    const repos = await client.listPublicRepos("ada");

    expect(repos).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=2");
  });

  it("should send the token as a bearer header", async () => {
    const { client, fetchMock } = clientWith([jsonResponse([])]);
    await client.listOwnRepos();
    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("should not send an authorization header without a token", async () => {
    const { client, fetchMock } = clientWith([jsonResponse([])], null);
    await client.listPublicRepos("ada");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Authorization");
  });

  it("should retry server errors and then succeed", async () => {
    const { client, fetchMock } = clientWith([jsonResponse({}, 502), jsonResponse([repoJson("quest")])]);
    expect(await client.listPublicRepos("ada")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should throw an auth error when the token is rejected", async () => {
    const { client } = clientWith([jsonResponse({ message: "Bad credentials" }, 401)]);
    await expect(client.getAuthenticatedAccount()).rejects.toBeInstanceOf(GitHubAuthError);
  });

  it("should throw a rate limit error when no requests are left", async () => {
    const { client } = clientWith([jsonResponse({}, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1900000000" })]);
    await expect(client.listPublicRepos("ada")).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it("should throw a not found error for an unknown account", async () => {
    const { client } = clientWith([jsonResponse({ message: "Not Found" }, 404)]);
    await expect(client.getAccount("nobody")).rejects.toBeInstanceOf(GitHubUserNotFoundError);
  });

  it("should skip the /user call when there is no token", async () => {
    const { client, fetchMock } = clientWith([], null);
    expect(await client.getAuthenticatedAccount()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("yearWindows", () => {
  it("should cover the whole range in windows of at most a year", () => {
    const windows = yearWindows(new Date("2020-01-01T00:00:00Z"), new Date("2022-06-01T00:00:00Z"));
    expect(windows).toHaveLength(3);
    expect(windows[0]?.from.toISOString()).toBe("2020-01-01T00:00:00.000Z");
    expect(windows.at(-1)?.to.toISOString()).toBe("2022-06-01T00:00:00.000Z");
  });
});

describe("GitHubClient.hasCommitsBy", () => {
  const repo: GitHubRepo = { owner: "babbage", name: "engine", fullName: "babbage/engine", cloneUrl: "", isPrivate: true, isFork: false, isUntouchedFork: false };

  it("should ask for one commit by the account", async () => {
    const { client, fetchMock } = clientWith([jsonResponse([{ sha: "abc" }])]);
    expect(await client.hasCommitsBy(repo, "ada")).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.github.com/repos/babbage/engine/commits?author=ada&per_page=1");
  });

  it("should say no when the account has no commits there", async () => {
    const { client } = clientWith([jsonResponse([])]);
    expect(await client.hasCommitsBy(repo, "ada")).toBe(false);
  });

  it("should say no for an empty repo instead of failing", async () => {
    const { client } = clientWith([jsonResponse({ message: "Git Repository is empty." }, 409)]);
    expect(await client.hasCommitsBy(repo, "ada")).toBe(false);
  });
});

describe("GitHubClient.listContributedRepos", () => {
  function contributions(...fullNames: string[]): Response {
    const entries = fullNames.map((fullName) => {
      const [owner = "", name = ""] = fullName.split("/");
      return { repository: { name, owner: { login: owner }, isPrivate: false, isFork: false } };
    });
    return jsonResponse({ data: { user: { contributionsCollection: { commitContributionsByRepository: entries } } } });
  }

  it("should ask for one year at a time, since the API refuses longer ranges", async () => {
    const { client, fetchMock } = clientWith([contributions("babbage/engine"), contributions("lovelace/notes")]);

    const repos = await client.listContributedRepos("ada", new Date("2024-01-01T00:00:00Z"), new Date("2025-06-01T00:00:00Z"));

    expect(repos.map((repo) => repo.fullName)).toEqual(["babbage/engine", "lovelace/notes"]);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { variables: { from: string; to: string } };
    expect(body.variables).toMatchObject({ from: "2024-12-31T00:00:00.000Z", to: "2025-06-01T00:00:00.000Z" });
  });

  it("should turn a GraphQL NOT_FOUND into a user not found error", async () => {
    const { client } = clientWith([jsonResponse({ data: { user: null }, errors: [{ type: "NOT_FOUND", message: "Could not resolve" }] })]);
    const listing = client.listContributedRepos("nobody", new Date("2025-01-01T00:00:00Z"), new Date("2025-06-01T00:00:00Z"));
    await expect(listing).rejects.toBeInstanceOf(GitHubUserNotFoundError);
  });
});
