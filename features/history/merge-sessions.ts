/**
 * Cursor pagination merge helper (AI-185).
 *
 * The sidebar appends one page at a time. A session can move between pages
 * while the user is paging, because sending a message bumps `updated_at` and
 * lifts the row to the top of the Recent block — so a row already on screen can
 * come back in a later page. Dropping ids we already hold keeps the list free of
 * duplicates without disturbing the order the server returned.
 */
export function mergeSessionPages<T extends { id: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  if (incoming.length === 0) return existing;

  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
