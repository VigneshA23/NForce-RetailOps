import { Search, X } from 'lucide-react';
import './SearchInput.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // 'surface': same layout as 'filter', but a white/bordered surface that
  // grows to fill its row -- for a filter row that isn't recessed inside a
  // card already (e.g. Orders), where the plain 'filter' gray box would look
  // sunken against the page background instead of sitting level with the
  // white dropdowns beside it.
  variant?: 'header' | 'card' | 'filter' | 'surface';
}

function SearchInput({ value, onChange, placeholder = 'Search...', variant = 'header' }: SearchInputProps) {
  if (variant === 'filter' || variant === 'surface') {
    return (
      <div className={`search-input--filter${variant === 'surface' ? ' search-input--filter--surface' : ''}`}>
        <Search size={14} className="search-input--filter__icon" aria-hidden="true" />
        <input
          type="search"
          className="search-input--filter__field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label="Search"
        />
        {value.length > 0 && (
          <button
            type="button"
            className="search-input__clear"
            aria-label="Clear search"
            onClick={() => onChange('')}
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <label className={`search-input search-input--${variant}`}>
      <Search size={16} />
      <input
        type="search"
        className="search-input__field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search"
      />
      {value.length > 0 && (
        <button
          type="button"
          className="search-input__clear"
          aria-label="Clear search"
          onClick={(event) => { event.preventDefault(); onChange(''); }}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}

export default SearchInput;
