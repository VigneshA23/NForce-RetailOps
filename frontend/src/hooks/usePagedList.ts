import { useEffect, useState } from 'react';

// Client-side paging over an already-filtered, already-ordered list.
//
// - Back to page 1 whenever `resetKey` changes (pass the filters joined into
//   one string, e.g. `${status}|${search}`).
// - The current page is clamped, so a poll that shrinks the list never
//   strands the view on a page that no longer exists.
// - `revealItem(id)` jumps to whichever page holds that item, once it is in
//   `items` -- for deep links (e.g. an issue opened from a notification).
//   It runs after the resetKey reset in the same commit, so clearing the
//   filters and revealing an item together lands on the item's page.
export function usePagedList<T extends { id: number }>(items: T[], pageSize: number, resetKey: string) {
  const [page, setPage] = useState(1);
  const [revealId, setRevealId] = useState<number | null>(null);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (revealId === null) return;
    const index = items.findIndex((item) => item.id === revealId);
    if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
    setRevealId(null);
  }, [revealId, items, pageSize]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return { page: currentPage, pageCount, pageItems, setPage, revealItem: setRevealId };
}
