import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GH_CLI_TIMEOUT_MS = 5_000;

/** Looks for a token in GITHUB_TOKEN, then GH_TOKEN, then the GitHub CLI's login. Null when none is found. */
export async function resolveGitHubToken(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const fromEnv = env.GITHUB_TOKEN?.trim() || env.GH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"], { timeout: GH_CLI_TIMEOUT_MS, encoding: "utf8" });
    return stdout.trim() || null;
  } catch {
    // gh is not installed or not logged in, so fall back to public repos only.
    return null;
  }
}
