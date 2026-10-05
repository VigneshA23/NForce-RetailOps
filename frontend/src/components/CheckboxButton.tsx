import './CheckboxButton.css';

interface CheckboxButtonProps {
  checked: boolean;
  indeterminate?: boolean;
  ariaLabel: string;
  onClick: () => void;
}

// A square, button-based checkbox (role="checkbox", not <input type="checkbox">)
// styled after the Orders redesign's selection checkboxes -- filled red when
// checked, a dash when indeterminate (a partially-selected supplier group).
function CheckboxButton({ checked, indeterminate = false, ariaLabel, onClick }: CheckboxButtonProps) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ? 'true' : indeterminate ? 'mixed' : 'false'}
      aria-label={ariaLabel}
      onClick={onClick}
      className="checkbox-button"
      style={{
        background: active ? '#e11d33' : '#ffffff',
        borderColor: active ? '#e11d33' : '#a1a1aa',
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
      {!checked && indeterminate && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      )}
    </button>
  );
}

export default CheckboxButton;
