import './PaginationBar.css';

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({ currentPage, totalPages, totalItems, pageSize, onPageChange }: PaginationBarProps) {
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="pagination-bar">
      <span className="pagination-bar__summary">
        Showing {rangeStart}-{rangeEnd} of {totalItems} entries
      </span>
      <div className="pagination-bar__controls">
        <button
          type="button"
          className="pagination-bar__nav"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Prev
        </button>
        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            className={`pagination-bar__page${page === currentPage ? ' pagination-bar__page--active' : ''}`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          className="pagination-bar__nav"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default PaginationBar;
