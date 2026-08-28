import { Search } from 'lucide-react';
import './SearchInput.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'header' | 'card';
}

function SearchInput({ value, onChange, placeholder = 'Search...', variant = 'header' }: SearchInputProps) {
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
