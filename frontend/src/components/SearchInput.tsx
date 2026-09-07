import { Search } from 'lucide-react';
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
          type="text"
          className="search-input--filter__field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label="Search"
        />
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
    </label>
  );
}

export default SearchInput;
