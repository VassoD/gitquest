export class GitNotFoundError extends Error {
  override name = "GitNotFoundError";
  constructor() {
    super("git is not installed or not on your PATH. Install git and try again.");
  }
}

export class GitCommandError extends Error {
  override name = "GitCommandError";
  constructor(
    readonly repoPath: string,
    readonly stderr: string,
  ) {
    super(`git failed in ${repoPath}`);
  }
}

export class NoReposFoundError extends Error {
  override name = "NoReposFoundError";
  constructor(readonly roots: string[]) {
    super(`No git repositories found under: ${roots.join(", ")}`);
  }
}
