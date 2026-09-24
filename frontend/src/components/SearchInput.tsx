import { Search, X } from 'lucide-react';
import './SearchInput.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'header' | 'card' | 'filter';
}

function SearchInput({ value, onChange, placeholder = 'Search...', variant = 'header' }: SearchInputProps) {
  if (variant === 'filter') {
    return (
      <div className="search-input--filter">
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
