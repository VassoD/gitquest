import type { Commit } from "../scan/types.js";
import type { First } from "./types.js";

interface FirstRule {
  key: string;
  label: string;
  pattern: RegExp;
}

export const FIRST_RULES: FirstRule[] = [
  { key: "test", label: "First test", pattern: /(\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$|(^|\/)__tests__\/)/ },
  { key: "docker", label: "First Dockerfile", pattern: /(^|\/)(Dockerfile[^/]*|docker-compose\.ya?ml|compose\.ya?ml)$/ },
  { key: "ci", label: "First CI pipeline", pattern: /(^\.github\/workflows\/.+\.ya?ml$|(^|\/)\.gitlab-ci\.yml$|^\.circleci\/)/ },
  { key: "migration", label: "First database migration", pattern: /(^|\/)migrations?\/[^/]+\.(sql|ts|js|py|rb)$/ },
  { key: "typescript", label: "First TypeScript file", pattern: /\.tsx?$/ },
  { key: "readme", label: "First README", pattern: /(^|\/)README(\.md)?$/i },
  { key: "infra", label: "First infrastructure as code", pattern: /\.tf$|(^|\/)(serverless|vercel|fly)\.(ya?ml|json|toml)$/ },
];

/** Commits must be sorted oldest first. */
export function detectFirsts(commits: Commit[]): First[] {
  const found = new Map<string, First>();
  for (const commit of commits) {
    const touched = commit.createdPaths.length > 0 ? commit.createdPaths : commit.files.map((file) => file.path);
    for (const rule of FIRST_RULES) {
      if (found.has(rule.key)) continue;
      const path = touched.find((candidate) => rule.pattern.test(candidate));
      if (path) found.set(rule.key, { key: rule.key, label: rule.label, date: commit.authoredAt, repo: commit.repo, path });
    }
    if (found.size === FIRST_RULES.length) break;
  }
  return [...found.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
