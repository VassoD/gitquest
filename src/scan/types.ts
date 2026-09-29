export interface FileChange {
  path: string;
  added: number;
  deleted: number;
  isBinary: boolean;
}

export interface Commit {
  hash: string;
  repo: string;
  authorEmail: string;
  authorName: string;
  authoredAt: Date;
  /** Calendar date in the author's own timezone, YYYY-MM-DD. */
  localDate: string;
  /** Hour of day in the author's own timezone, 0 to 23. */
  localHour: number;
  /** Day of week in the author's own timezone, 0 is Sunday. */
  localWeekday: number;
  subject: string;
  files: FileChange[];
  createdPaths: string[];
}
