import { mapWithConcurrency } from "../shared/map-with-concurrency.js";
import type { GitHubAccount, GitHubClient, GitHubRepo } from "./api.js";

/** Accounts always carry a creation date. This is a safe floor if one ever does not. */
const GITHUB_LAUNCH = "2008-01-01T00:00:00Z";
const COMMIT_CHECK_CONCURRENCY = 4;

export interface GitHubSource {
  account: GitHubAccount;
  /** Owned repos first, then repos owned by others that hold the account's commits. */
  repos: GitHubRepo[];
  ownedCount: number;
  /** False when the token is missing or belongs to someone else, so only public repos are listed. */
  includesPrivate: boolean;
}

export interface ResolveOptions {
  /** Called while org and collaborator repos are checked for the account's commits. */
  onCheckProgress?: (done: number, total: number) => void;
}

function keyOf(repo: GitHubRepo): string {
  return repo.fullName.toLowerCase();
}

function mergeRepos(...groups: GitHubRepo[][]): GitHubRepo[] {
  const byName = new Map<string, GitHubRepo>();
  for (const repo of groups.flat()) {
    if (!byName.has(keyOf(repo))) byName.set(keyOf(repo), repo);
  }
  return [...byName.values()];
}

/**
 * Every repo holding the account's commits, wherever it lives:
 * - repos it owns, since commits on other branches or in forks are invisible to GitHub's stats. Forks
 *   nobody pushed to are skipped: they only hold someone else's history and are often the biggest downloads;
 * - repos owned by others that GitHub's contribution graph credits it in, like open source it contributed to;
 * - org and collaborator repos it can read, checked one by one, because the contribution graph hides most
 *   private org work. Repos it merely has access to, without any of its commits, are left out.
 */
export async function resolveGitHubSource(client: GitHubClient, login: string, options: ResolveOptions = {}): Promise<GitHubSource> {
  const tokenOwner = await client.getAuthenticatedAccount();
  const isSelf = tokenOwner !== null && tokenOwner.login.toLowerCase() === login.toLowerCase();
  const account = isSelf ? tokenOwner : await client.getAccount(login);

  const [owned, contributed, accessible] = await Promise.all([
    isSelf ? client.listOwnRepos() : client.listPublicRepos(account.login),
    client.isAuthenticated ? client.listContributedRepos(account.login, account.createdAt ?? new Date(GITHUB_LAUNCH)) : [],
    isSelf ? client.listAccessibleRepos() : [],
  ]);

  const known = new Set([...owned, ...contributed].map(keyOf));
  const unchecked = accessible.filter((repo) => !known.has(keyOf(repo)));
  const hasCommits = await mapWithConcurrency(
    unchecked,
    COMMIT_CHECK_CONCURRENCY,
    async (repo) => client.hasCommitsBy(repo, account.login),
    options.onCheckProgress,
  );
  const committedTo = unchecked.filter((_, index) => hasCommits[index]);

  const repos = mergeRepos(owned.filter((repo) => !repo.isUntouchedFork), contributed, committedTo);
  const ownLogin = account.login.toLowerCase();
  return {
    account,
    repos,
    ownedCount: repos.filter((repo) => repo.owner.toLowerCase() === ownLogin).length,
    includesPrivate: isSelf,
  };
}

/** GitHub commits made from the web UI or with "keep my email private" use these addresses. */
export function accountEmails(account: GitHubAccount): string[] {
  const login = account.login.toLowerCase();
  const noreply = [`${account.id}+${login}@users.noreply.github.com`, `${login}@users.noreply.github.com`];
  return account.email ? [account.email, ...noreply] : noreply;
}
