import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

interface PaginationProps {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  // Optional noun after the count, e.g. "categories" -> "Showing 1-7 of 7 categories".
  itemLabel?: string;
}

function Pagination({ page, pageCount, totalItems, pageSize, onPageChange, itemLabel }: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="pagination">
      <span className="pagination__summary">
        Showing {start}-{end} of {totalItems}
        {itemLabel && ` ${itemLabel}`}
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="pagination__page">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className="pagination__button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
