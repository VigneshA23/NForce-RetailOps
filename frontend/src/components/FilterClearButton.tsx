import { FilterX } from 'lucide-react';
import './FilterClearButton.css';

interface FilterClearButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

// Shared reset affordance for a .filter-bar -- resets only filter state,
// never the adjacent search text (that's SearchInput's own per-field clear
// button). Icon-only and always rendered (not conditional on whether a
// filter is currently active), so it's a stable, always-findable reset
// control in every filter bar rather than something that pops in and out.
function FilterClearButton({ onClick, ariaLabel = 'Clear filters' }: FilterClearButtonProps) {
  return (
    <button type="button" className="filter-bar__clear" onClick={onClick} aria-label={ariaLabel} title={ariaLabel}>
      <FilterX size={14} />
    </button>
  );
}

export default FilterClearButton;
