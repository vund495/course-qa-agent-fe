/** One page size for every browsing list in the app. */
export const PAGE_SIZE = 20;

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageCount,
  };
}
