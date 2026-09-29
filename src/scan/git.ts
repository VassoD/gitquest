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

export async function runGit(repoPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], {
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: "utf8",
    });
    return stdout;
  } catch (error: unknown) {
    const execError = error as ExecError;
    if (execError.code === "ENOENT") throw new GitNotFoundError();
    throw new GitCommandError(repoPath, execError.stderr ?? String(error));
  }
}

export async function readGlobalEmail(): Promise<string | null> {
  try {
    const email = await runGit(process.cwd(), ["config", "--global", "user.email"]);
    return email.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}
