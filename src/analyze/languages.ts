export type Discipline = "frontend" | "style" | "backend" | "mobile" | "test" | "docs" | "infra" | "data" | "other";

interface LanguageInfo {
  name: string;
  discipline: Discipline;
}

const BY_EXTENSION: Record<string, LanguageInfo> = {
  ts: { name: "TypeScript", discipline: "frontend" },
  tsx: { name: "TypeScript", discipline: "frontend" },
  js: { name: "JavaScript", discipline: "frontend" },
  jsx: { name: "JavaScript", discipline: "frontend" },
  mjs: { name: "JavaScript", discipline: "frontend" },
  cjs: { name: "JavaScript", discipline: "frontend" },
  vue: { name: "Vue", discipline: "frontend" },
  svelte: { name: "Svelte", discipline: "frontend" },
  css: { name: "CSS", discipline: "style" },
  scss: { name: "CSS", discipline: "style" },
  sass: { name: "CSS", discipline: "style" },
  less: { name: "CSS", discipline: "style" },
  html: { name: "HTML", discipline: "frontend" },
  py: { name: "Python", discipline: "backend" },
  go: { name: "Go", discipline: "backend" },
  rs: { name: "Rust", discipline: "backend" },
  java: { name: "Java", discipline: "backend" },
  kt: { name: "Kotlin", discipline: "backend" },
  rb: { name: "Ruby", discipline: "backend" },
  php: { name: "PHP", discipline: "backend" },
  cs: { name: "C#", discipline: "backend" },
  c: { name: "C", discipline: "backend" },
  cpp: { name: "C++", discipline: "backend" },
  swift: { name: "Swift", discipline: "mobile" },
  dart: { name: "Dart", discipline: "mobile" },
  ex: { name: "Elixir", discipline: "backend" },
  sql: { name: "SQL", discipline: "data" },
  ipynb: { name: "Jupyter", discipline: "data" },
  r: { name: "R", discipline: "data" },
  tf: { name: "Terraform", discipline: "infra" },
  sh: { name: "Shell", discipline: "infra" },
  yml: { name: "YAML", discipline: "infra" },
  yaml: { name: "YAML", discipline: "infra" },
  md: { name: "Markdown", discipline: "docs" },
  mdx: { name: "Markdown", discipline: "docs" },
  rst: { name: "reStructuredText", discipline: "docs" },
};

/** Languages that count toward Polyglot. Config formats like YAML and markup like HTML do not. */
const PROGRAMMING_LANGUAGES = new Set([
  "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "Kotlin", "Ruby", "PHP",
  "C#", "C", "C++", "Swift", "Dart", "Elixir", "SQL", "R", "Terraform", "Shell", "Vue", "Svelte",
]);

const TEST_PATH = /(^|\/)(__tests__|tests?|spec|e2e|cypress)\/|\.(test|spec|e2e|cy)\.[a-z]+$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$/i;
const MOBILE_PATH = /(^|\/)(ios|android)\//i;
/** Matches folders like `api/`, `newspulse-backend/` or `api-gateway/`. */
const SERVER_PATH = /(^|\/)([\w.]*[-_.])?(api|server|backend|functions|lambdas?|workers?|prisma|migrations|graphql)([-_.][\w.-]*)?\//i;
/** NestJS-style suffixes. `.service` and `.module` are left out because Angular uses them on the frontend too. */
const SERVER_FILE = /\.(controller|resolver|entity|dto|repository|guard|gateway|middleware)\.[cm]?[jt]s$/i;
/** Plain .ts/.js can run on either side. Component files like .tsx always belong to the frontend. */
const EITHER_SIDE_EXTENSIONS = new Set(["ts", "js", "mjs", "cjs"]);
/** Written by release tools, not by hand. */
const GENERATED_DOCS = /^(CHANGELOG|HISTORY)\b/i;

function disciplineFor(path: string, extension: string, base: Discipline): Discipline {
  if (TEST_PATH.test(path)) return "test";
  if (MOBILE_PATH.test(path)) return "mobile";
  if (EITHER_SIDE_EXTENSIONS.has(extension) && (SERVER_PATH.test(path) || SERVER_FILE.test(path))) return "backend";
  return base;
}

export function languageOf(path: string): LanguageInfo | null {
  const fileName = path.split("/").pop() ?? path;
  if (/^Dockerfile/i.test(fileName)) return { name: "Docker", discipline: "infra" };
  if (GENERATED_DOCS.test(fileName)) return null;
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : undefined;
  const info = extension ? BY_EXTENSION[extension] : undefined;
  if (!extension || !info) return null;
  return { name: info.name, discipline: disciplineFor(path, extension, info.discipline) };
}

export function isProgrammingLanguage(name: string): boolean {
  return PROGRAMMING_LANGUAGES.has(name);
}

const NOISE_PATH = new RegExp(
  [
    String.raw`(^|/)(node_modules|dist|build|vendor|\.next|coverage|logs?)/`,
    String.raw`(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|go\.sum)$`,
    String.raw`\.min\.(js|css)$`,
    String.raw`\.(log|map)$`,
  ].join("|"),
);

/** Lockfiles, logs, build output and vendored code say nothing about the author. */
export function isNoisePath(path: string): boolean {
  return NOISE_PATH.test(path);
}
