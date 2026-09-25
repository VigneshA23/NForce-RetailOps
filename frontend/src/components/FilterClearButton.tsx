import { X } from 'lucide-react';
import './FilterClearButton.css';

interface FilterClearButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

// Shared "Clear" affordance for a .filter-bar's active filter selects --
// resets only filter state, never the adjacent search text (that's
// SearchInput's own per-field clear button). Matches the outlined
// icon+label pill the Checklist page's Completed/Flagged table already used
// for its own filter-clear button (store-detail-page__filter-clear).
function FilterClearButton({ onClick, ariaLabel = 'Clear filters' }: FilterClearButtonProps) {
  return (
    <button type="button" className="filter-bar__clear" onClick={onClick} aria-label={ariaLabel}>
      <X size={12} />
      Clear
    </button>
  );
}

export default FilterClearButton;
