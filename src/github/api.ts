import { GitHubApiError, GitHubAuthError, GitHubRateLimitError, GitHubResponseError, GitHubUserNotFoundError } from "./errors.js";

const API_BASE_URL = "https://api.github.com";
const WEB_BASE_URL = "https://github.com";
const API_VERSION = "2022-11-28";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const PAGE_SIZE = 100;
/** 50 pages of 100 is far more repos than any real account, and stops a runaway loop. */
const MAX_PAGES = 50;
/** contributionsCollection refuses ranges longer than a year, and caps repos per range at 100. */
const MAX_CONTRIBUTION_REPOS = 100;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
/** GitHub answers 409 Conflict when asked for the commits of an empty repo. */
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
/** GitHub owner and repo names only use these characters, which also keeps them safe as folder names. */
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export interface GitHubAccount {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  createdAt: Date | null;
}

export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  isPrivate: boolean;
  isFork: boolean;
  /** A fork nobody pushed to after forking, so it only holds the original project's commits. */
  isUntouchedFork: boolean;
}

export interface DateWindow {
  from: Date;
  to: Date;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

export interface GitHubClientOptions {
  token: string | null;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSafeName(value: unknown): value is string {
  return typeof value === "string" && SAFE_NAME.test(value) && value !== "." && value !== "..";
}

function dig(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function cloneUrlFor(owner: string, name: string): string {
  return `${WEB_BASE_URL}/${owner}/${name}.git`;
}

export function parseAccount(value: unknown, path: string): GitHubAccount {
  if (!isRecord(value) || typeof value.login !== "string" || typeof value.id !== "number") throw new GitHubResponseError(path);
  return {
    login: value.login,
    id: value.id,
    name: typeof value.name === "string" && value.name ? value.name : null,
    email: typeof value.email === "string" && value.email ? value.email.toLowerCase() : null,
    createdAt: typeof value.created_at === "string" ? new Date(value.created_at) : null,
  };
}

/** Returns null for entries that are malformed or have names we would not trust as folder names. */
export function parseRepo(value: unknown): GitHubRepo | null {
  if (!isRecord(value) || !isRecord(value.owner)) return null;
  const { name, clone_url: cloneUrl, private: isPrivate, fork: isFork, created_at: createdAt, pushed_at: pushedAt } = value;
  const owner = value.owner.login;
  if (!isSafeName(owner) || !isSafeName(name)) return null;
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
    cloneUrl: typeof cloneUrl === "string" ? cloneUrl : cloneUrlFor(owner, name),
    isPrivate: isPrivate === true,
    isFork: isFork === true,
    // A fresh fork keeps the parent's last push date, which is older than the fork itself.
    isUntouchedFork: isFork === true && typeof createdAt === "string" && typeof pushedAt === "string" && pushedAt <= createdAt,
  };
}

/** Reads a GraphQL `Repository` node selected by CONTRIBUTED_REPOS_QUERY. */
export function parseGraphQLRepo(value: unknown): GitHubRepo | null {
  if (!isRecord(value) || !isRecord(value.owner)) return null;
  const { name, isPrivate, isFork } = value;
  const owner = value.owner.login;
  if (!isSafeName(owner) || !isSafeName(name)) return null;
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
    cloneUrl: cloneUrlFor(owner, name),
    isPrivate: isPrivate === true,
    isFork: isFork === true,
    isUntouchedFork: false,
  };
}

const CONTRIBUTED_REPOS_QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: ${MAX_CONTRIBUTION_REPOS}) {
        repository { name owner { login } isPrivate isFork }
      }
    }
  }
}`;

/** Splits [from, to) into windows of at most a year, oldest first. */
export function yearWindows(from: Date, to: Date): DateWindow[] {
  const windows: DateWindow[] = [];
  for (let start = from.getTime(); start < to.getTime(); start += ONE_YEAR_MS) {
    windows.push({ from: new Date(start), to: new Date(Math.min(start + ONE_YEAR_MS, to.getTime())) });
  }
  return windows;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function rateLimitReset(response: Response): Date | null {
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  return Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null;
}

function isRateLimited(response: Response): boolean {
  return response.status === HTTP_TOO_MANY_REQUESTS ||
    (response.status === HTTP_FORBIDDEN && response.headers.get("x-ratelimit-remaining") === "0");
}

export class GitHubClient {
  private readonly token: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly retryDelayMs: number;

  constructor(options: GitHubClientOptions) {
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? RETRY_BASE_DELAY_MS;
  }

  get isAuthenticated(): boolean {
    return this.token !== null;
  }

  /** The account the token belongs to, or null without a token. */
  async getAuthenticatedAccount(): Promise<GitHubAccount | null> {
    if (!this.token) return null;
    return parseAccount(await this.request("/user"), "/user");
  }

  async getAccount(login: string): Promise<GitHubAccount> {
    const path = `/users/${encodeURIComponent(login)}`;
    try {
      return parseAccount(await this.request(path), path);
    } catch (error: unknown) {
      if (error instanceof GitHubApiError && error.status === HTTP_NOT_FOUND) throw new GitHubUserNotFoundError(login);
      throw error;
    }
  }

  /** Repos the token owner owns, private ones included. */
  async listOwnRepos(): Promise<GitHubRepo[]> {
    return this.listPaged("/user/repos?affiliation=owner&sort=full_name");
  }

  /** Repos the token owner can read without owning them: org repos and ones they were added to. */
  async listAccessibleRepos(): Promise<GitHubRepo[]> {
    return this.listPaged("/user/repos?affiliation=collaborator,organization_member&sort=full_name");
  }

  /** Public repos owned by any account. */
  async listPublicRepos(login: string): Promise<GitHubRepo[]> {
    return this.listPaged(`/users/${encodeURIComponent(login)}/repos?type=owner&sort=full_name`);
  }

  /** Whether the repo's default branch holds at least one commit GitHub links to the account. */
  async hasCommitsBy(repo: GitHubRepo, login: string): Promise<boolean> {
    const path = `/repos/${repo.owner}/${repo.name}/commits?author=${encodeURIComponent(login)}&per_page=1`;
    try {
      const body = await this.request(path);
      if (!Array.isArray(body)) throw new GitHubResponseError(path);
      return body.length > 0;
    } catch (error: unknown) {
      // An empty repo, or one we lost access to since it was listed.
      if (error instanceof GitHubApiError && (error.status === HTTP_CONFLICT || error.status === HTTP_NOT_FOUND)) return false;
      throw error;
    }
  }

  /**
   * Repos GitHub credits the account with commits in, year by year. Public ones are reliable. Private org
   * repos are often hidden as "restricted contributions", even from the account's own token, which is why
   * accessible repos are also checked one by one with `hasCommitsBy`. Needs a token.
   */
  async listContributedRepos(login: string, since: Date, now = new Date()): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    for (const window of yearWindows(since, now)) {
      const data = await this.graphql(CONTRIBUTED_REPOS_QUERY, { login, from: window.from.toISOString(), to: window.to.toISOString() });
      const entries = dig(data, "user", "contributionsCollection", "commitContributionsByRepository");
      if (!Array.isArray(entries)) throw new GitHubResponseError("/graphql");
      repos.push(...entries.map((entry) => parseGraphQLRepo(dig(entry, "repository"))).filter((repo): repo is GitHubRepo => repo !== null));
    }
    return repos;
  }

  private async graphql(query: string, variables: Record<string, string>): Promise<unknown> {
    const body = await this.request("/graphql", { method: "POST", body: { query, variables } });
    const errors = dig(body, "errors");
    if (Array.isArray(errors) && errors.length) {
      if (errors.some((error) => dig(error, "type") === "NOT_FOUND")) throw new GitHubUserNotFoundError(String(variables.login));
      throw new GitHubApiError(`GitHub GraphQL error: ${String(dig(errors[0], "message") ?? "unknown")}`, null);
    }
    return dig(body, "data");
  }

  private async listPaged(path: string): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const pagePath = `${path}&per_page=${PAGE_SIZE}&page=${page}`;
      const body = await this.request(pagePath);
      if (!Array.isArray(body)) throw new GitHubResponseError(pagePath);
      repos.push(...body.map(parseRepo).filter((repo): repo is GitHubRepo => repo !== null));
      if (body.length < PAGE_SIZE) break;
    }
    return repos;
  }

  private async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "gitquest",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(`${API_BASE_URL}${path}`, {
          method: options.method ?? "GET",
          headers,
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error: unknown) {
        if (attempt >= MAX_ATTEMPTS) {
          throw new GitHubApiError(`Could not reach GitHub: ${error instanceof Error ? error.message : String(error)}`, null);
        }
        await delay(this.retryDelayMs * 2 ** (attempt - 1));
        continue;
      }

      if (response.ok) return response.json();
      if (response.status === HTTP_UNAUTHORIZED) throw new GitHubAuthError();
      if (isRateLimited(response)) throw new GitHubRateLimitError(rateLimitReset(response));
      if (response.status >= HTTP_SERVER_ERROR && attempt < MAX_ATTEMPTS) {
        await delay(this.retryDelayMs * 2 ** (attempt - 1));
        continue;
      }
      throw new GitHubApiError(`GitHub answered ${response.status} for ${path}.`, response.status);
    }
  }
}
