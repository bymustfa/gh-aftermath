export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Concurrency limit must be an integer of at least 1.");
  }
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const current = next;
      next += 1;
      const item = items[current];
      if (item === undefined) return;
      results[current] = await worker(item, current);
    }
  }

  const runners = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: runners }, () => run()));
  return results;
}
