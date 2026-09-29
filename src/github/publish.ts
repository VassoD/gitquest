import type { GitHubClient, RepoFile } from "./api.js";
import { GitHubApiError, GitHubPublishError, GitHubRateLimitError } from "./errors.js";

/** Cards live in this folder of the profile repo, next to the README that shows them. */
export const PUBLISH_FOLDER = "gitquest";
const DEFAULT_README_PATH = "README.md";
const COMMIT_MESSAGE = "chore: update gitquest cards";
/** Any link to a file in the cards folder counts, so a README showing the badge instead of the card is left alone. */
const CARD_LINK = new RegExp(`${PUBLISH_FOLDER}/[\\w-]+\\.svg`);
/** GitHub hides repos a token cannot write to behind 404, and answers 403 for read-only tokens. */
const NO_WRITE_ACCESS = new Set([403, 404]);
/** The branch moved since we read it, and GitHub refuses to overwrite it. */
const HTTP_UNPROCESSABLE = 422;

export interface CardFile {
  /** File name inside the cards folder, like card.svg. */
  name: string;
  svg: string;
}

export interface PublishResult {
  repoUrl: string;
  /** False when the cards were already up to date, so nothing was committed. */
  committed: boolean;
  /** Set when the README did not show a card yet and one was added to it. */
  readmePath: string | null;
}

/** The README with a card added at the end, or null when it already shows a gitquest card. */
export function withCardEmbed(readme: string, cardName: string): string | null {
  if (CARD_LINK.test(readme)) return null;
  const embed = `![gitquest](./${PUBLISH_FOLDER}/${cardName})\n`;
  const trimmed = readme.trimEnd();
  return trimmed ? `${trimmed}\n\n${embed}` : embed;
}

/**
 * Commits the cards to the account's profile repo (`<login>/<login>`, whose README GitHub shows on the profile
 * page) in a single commit, and makes the README show `embedCard` if it shows no card yet.
 */
export async function publishCards(client: GitHubClient, login: string, cards: CardFile[], embedCard: string): Promise<PublishResult> {
  const repoUrl = `https://github.com/${login}/${login}`;
  const branch = await client.getDefaultBranch(login, login);
  if (branch === null) {
    throw new GitHubPublishError(`${repoUrl} does not exist yet. Create a public repo named "${login}" on GitHub, then publish again.`);
  }
  const head = await client.getBranchHead(login, login, branch);
  if (head === null) {
    throw new GitHubPublishError(`${repoUrl} is empty. Add a README to it on GitHub, then publish again.`);
  }

  const files: RepoFile[] = cards.map((card) => ({ path: `${PUBLISH_FOLDER}/${card.name}`, content: card.svg }));
  const readme = await client.getReadme(login, login, head.commit);
  const updatedReadme = withCardEmbed(readme?.content ?? "", embedCard);
  const readmePath = readme?.path ?? DEFAULT_README_PATH;
  if (updatedReadme !== null) files.push({ path: readmePath, content: updatedReadme });

  try {
    const commit = await client.commitFiles(login, login, head, files, COMMIT_MESSAGE);
    if (commit === null) return { repoUrl, committed: false, readmePath: null };
    await client.updateBranch(login, login, branch, commit);
    return { repoUrl, committed: true, readmePath: updatedReadme === null ? null : readmePath };
  } catch (error: unknown) {
    if (!(error instanceof GitHubApiError) || error instanceof GitHubRateLimitError || error.status === null) throw error;
    if (NO_WRITE_ACCESS.has(error.status)) {
      throw new GitHubPublishError(`Your GitHub token cannot write to ${repoUrl}. Run \`gh auth refresh -s repo\`, or use a token with the "repo" scope.`);
    }
    if (error.status === HTTP_UNPROCESSABLE) {
      throw new GitHubPublishError(`${repoUrl} changed while publishing. Run gitquest again.`);
    }
    throw error;
  }
}
