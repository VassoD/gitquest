export class GitHubApiError extends Error {
  override name = "GitHubApiError";
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export class GitHubAuthError extends GitHubApiError {
  override name = "GitHubAuthError";
  constructor() {
    super("GitHub rejected your token. Check GITHUB_TOKEN, or run `gh auth login` again.", 401);
  }
}

export class GitHubUserNotFoundError extends GitHubApiError {
  override name = "GitHubUserNotFoundError";
  constructor(readonly login: string) {
    super(`No GitHub account called "${login}".`, 404);
  }
}

export class GitHubRateLimitError extends GitHubApiError {
  override name = "GitHubRateLimitError";
  constructor(readonly resetsAt: Date | null) {
    const when = resetsAt ? ` It resets at ${resetsAt.toLocaleTimeString("en-US")}.` : "";
    super(`GitHub API rate limit reached.${when} Set GITHUB_TOKEN to get a higher limit.`, 403);
  }
}

export class GitHubResponseError extends GitHubApiError {
  override name = "GitHubResponseError";
  constructor(readonly path: string) {
    super(`GitHub sent an unexpected response for ${path}.`, null);
  }
}
