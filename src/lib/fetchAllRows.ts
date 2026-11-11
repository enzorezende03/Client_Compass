/**
 * The backend returns at most 1000 rows per request. Use this helper for any
 * list that can grow past that, so records are never silently cut off.
 * `build(from, to)` must return a query with a stable order (e.g. ending in .order('id')).
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return { data: all, error: null };
}
