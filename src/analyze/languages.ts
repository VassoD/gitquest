export type Discipline = "frontend" | "backend" | "infra" | "data" | "other";

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
  vue: { name: "Vue", discipline: "frontend" },
  svelte: { name: "Svelte", discipline: "frontend" },
  css: { name: "CSS", discipline: "frontend" },
  scss: { name: "CSS", discipline: "frontend" },
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
  swift: { name: "Swift", discipline: "backend" },
  dart: { name: "Dart", discipline: "frontend" },
  ex: { name: "Elixir", discipline: "backend" },
  sql: { name: "SQL", discipline: "data" },
  ipynb: { name: "Jupyter", discipline: "data" },
  r: { name: "R", discipline: "data" },
  tf: { name: "Terraform", discipline: "infra" },
  sh: { name: "Shell", discipline: "infra" },
  yml: { name: "YAML", discipline: "infra" },
  yaml: { name: "YAML", discipline: "infra" },
};

/** Languages that count toward Polyglot. Config formats like YAML and markup like HTML do not. */
const PROGRAMMING_LANGUAGES = new Set([
  "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "Kotlin", "Ruby", "PHP",
  "C#", "C", "C++", "Swift", "Dart", "Elixir", "SQL", "R", "Terraform", "Shell", "Vue", "Svelte",
]);

export function languageOf(path: string): LanguageInfo | null {
  const fileName = path.split("/").pop() ?? path;
  if (/^Dockerfile/i.test(fileName)) return { name: "Docker", discipline: "infra" };
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : undefined;
  return extension ? (BY_EXTENSION[extension] ?? null) : null;
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
