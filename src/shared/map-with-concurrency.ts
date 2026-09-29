/** Maps items with at most `limit` in flight at once, keeping the input order in the result. */
export async function mapWithConcurrency<Item, Result>(
  items: Item[],
  limit: number,
  mapper: (item: Item) => Promise<Result>,
  onProgress?: (done: number, total: number) => void,
): Promise<Result[]> {
  const results: Result[] = new Array<Result>(items.length);
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await mapper(items[index] as Item);
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
