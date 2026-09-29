import type { Commit } from "../scan/types.js";

export interface AuthorIdentity {
  email: string;
  names: string[];
  commits: number;
  repos: number;
}

export interface KnownSelf {
  email: string | null;
  name: string | null;
}

/** Groups commits by author email, busiest first. */
export function collectAuthors(commits: Commit[]): AuthorIdentity[] {
  const byEmail = new Map<string, { names: Set<string>; commits: number; repos: Set<string> }>();
  for (const commit of commits) {
    const entry = byEmail.get(commit.authorEmail) ?? { names: new Set(), commits: 0, repos: new Set() };
    if (commit.authorName) entry.names.add(commit.authorName);
    entry.commits += 1;
    entry.repos.add(commit.repo);
    byEmail.set(commit.authorEmail, entry);
  }
  return [...byEmail.entries()]
    .map(([email, entry]) => ({ email, names: [...entry.names], commits: entry.commits, repos: entry.repos.size }))
    .sort((a, b) => b.commits - a.commits);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function localPart(email: string): string {
  const [local = ""] = email.split("@");
  // GitHub noreply addresses look like 12345+username@users.noreply.github.com
  return local.replace(/^\d+\+/, "");
}

/**
 * Guesses which emails belong to the person running gitquest, using their git config.
 * A match on email, author name or the part before the @ is enough to pre-select it.
 */
export function suggestOwnEmails(authors: AuthorIdentity[], self: KnownSelf): string[] {
  const ownEmail = self.email ? normalize(self.email) : null;
  const ownName = self.name ? normalize(self.name) : null;
  const ownLocalPart = ownEmail ? localPart(ownEmail) : null;

  return authors
    .filter((author) =>
      author.email === ownEmail ||
      (ownName !== null && author.names.some((name) => normalize(name) === ownName)) ||
      (ownLocalPart !== null && localPart(author.email) === ownLocalPart))
    .map((author) => author.email);
}
