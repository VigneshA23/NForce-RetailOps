import { useCallback, useState } from 'react';

// Never fewer cards on a page than the old fixed page size.
export const MIN_CARDS_PER_PAGE = 12;
const MIN_ROWS = 2;

// Cards per page for a paged card grid: always whole rows, so zooming out (or
// a wider screen) fills the extra columns with the next items instead of
// leaving a gap. At least MIN_ROWS rows and MIN_CARDS_PER_PAGE cards.
export function cardPageSize(columns: number | null): number {
  if (!columns || columns < 1) return MIN_CARDS_PER_PAGE;
  const rows = Math.max(MIN_ROWS, Math.ceil(MIN_CARDS_PER_PAGE / columns));
  return columns * rows;
}

// Pair with a grid that reports its column count (StoreInventoryCardGrid's
// onColumnsChange). Until it reports, the page size is MIN_CARDS_PER_PAGE.
export function useCardPageSize() {
  const [columns, setColumns] = useState<number | null>(null);
  const onColumnsChange = useCallback((next: number) => {
    setColumns((prev) => (prev === next ? prev : next));
  }, []);
  return { pageSize: cardPageSize(columns), onColumnsChange };
}
