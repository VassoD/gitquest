import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitCommandError, GitNotFoundError } from "./errors.js";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 1024 * 1024 * 512;

interface ExecError {
  code?: string | number;
  stderr?: string;
}

export interface RunGitOptions {
  /** Merged over the current environment. */
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Written to git's stdin, for commands that read a list from it. */
  input?: string;
}

export async function runGit(repoPath: string, args: string[], options: RunGitOptions = {}): Promise<string> {
  try {
    const running = execFileAsync("git", ["-C", repoPath, ...args], {
      timeout: options.timeoutMs ?? GIT_TIMEOUT_MS,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: "utf8",
    });
    // When git exits before reading its input, the write fails with EPIPE. The exit code already reports that.
    running.child.stdin?.on("error", () => undefined);
    running.child.stdin?.end(options.input ?? "");
    const { stdout } = await running;
    return stdout;
  } catch (error: unknown) {
    const execError = error as ExecError;
    if (execError.code === "ENOENT") throw new GitNotFoundError();
    throw new GitCommandError(repoPath, execError.stderr ?? String(error));
  }
}

/** Reads a global git config value, or null when it is not set. */
export async function readGitConfig(key: "user.email" | "user.name"): Promise<string | null> {
  try {
    const value = (await runGit(process.cwd(), ["config", "--global", key])).trim();
    return value ? (key === "user.email" ? value.toLowerCase() : value) : null;
  } catch {
    return null;
  }
}
