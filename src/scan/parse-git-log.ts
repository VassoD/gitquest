import type { Commit, FileChange } from "./types.js";

export const RECORD_SEPARATOR = "\x1e";
export const FIELD_SEPARATOR = "\x1f";

/** Pass to `git log --pretty=format:` so parseGitLog can split the output. */
export const GIT_LOG_FORMAT = `${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s`;

const NUMSTAT_LINE = /^(\d+|-)\t(\d+|-)\t(.+)$/;
const CREATE_LINE = /^ create mode \d+ (.+)$/;
const ISO_HOUR = /T(\d{2}):/;

/**
 * Git prints renames as `old => new` or `dir/{old => new}/file`.
 * We only care about where the file lives now.
 */
export function resolveRenamedPath(rawPath: string): string {
  const braced = rawPath.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (braced) {
    const [, prefix = "", , next = "", suffix = ""] = braced;
    return `${prefix}${next}${suffix}`.replace(/\/\//g, "/");
  }
  const plain = rawPath.split(" => ");
  return plain.length === 2 ? (plain[1] ?? rawPath) : rawPath;
}

function parseHeader(header: string, repo: string): Omit<Commit, "files" | "createdPaths"> | null {
  const [hash, authorEmail, authorName = "", isoDate, ...subjectParts] = header.split(FIELD_SEPARATOR);
  if (!hash || !authorEmail || !isoDate) return null;
  const authoredAt = new Date(isoDate);
  if (Number.isNaN(authoredAt.getTime())) return null;
  const localDate = isoDate.slice(0, 10);
  return {
    hash,
    repo,
    authorEmail: authorEmail.toLowerCase(),
    authorName,
    authoredAt,
    localDate,
    localHour: Number(isoDate.match(ISO_HOUR)?.[1] ?? authoredAt.getUTCHours()),
    localWeekday: new Date(`${localDate}T00:00:00Z`).getUTCDay(),
    subject: subjectParts.join(FIELD_SEPARATOR),
  };
}

/** Parses the output of `git log --numstat --summary --pretty=format:GIT_LOG_FORMAT`. */
export function parseGitLog(output: string, repo: string): Commit[] {
  const commits: Commit[] = [];
  for (const record of output.split(RECORD_SEPARATOR)) {
    if (!record.trim()) continue;
    const [header = "", ...body] = record.split("\n");
    const base = parseHeader(header, repo);
    if (!base) continue;

    const files: FileChange[] = [];
    const createdPaths: string[] = [];
    for (const line of body) {
      const numstat = line.match(NUMSTAT_LINE);
      if (numstat) {
        const [, added = "0", deleted = "0", path = ""] = numstat;
        const isBinary = added === "-";
        files.push({
          path: resolveRenamedPath(path),
          added: isBinary ? 0 : Number(added),
          deleted: isBinary ? 0 : Number(deleted),
          isBinary,
        });
        continue;
      }
      const created = line.match(CREATE_LINE);
      if (created?.[1]) createdPaths.push(created[1]);
    }
    commits.push({ ...base, files, createdPaths });
  }
  return commits;
}
