const THOUSAND = 1_000;
const MILLION = 1_000_000;

export function compactNumber(value: number): string {
  if (value >= MILLION) return `${(value / MILLION).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= THOUSAND * 10) return `${Math.round(value / THOUSAND)}k`;
  return value.toLocaleString("en-US");
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
