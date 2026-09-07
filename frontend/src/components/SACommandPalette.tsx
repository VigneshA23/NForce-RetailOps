import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Building2, Search, Store, Users } from 'lucide-react';
import { superAdminSearch, type SASearchItem, type SASearchResponse } from '../api/superAdminSearch';
import './SACommandPalette.css';

interface SACommandPaletteProps {
  onNavigate: (navTarget: string) => void;
}

const EMPTY: SASearchResponse = { owners: [], stores: [], employees: [] };

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SkeletonResults() {
  return (
    <div className="sacp__skeleton" aria-hidden="true">
      <div className="sacp__skeleton-group-label" />
      <div className="sacp__skeleton-row sacp__skeleton-row--wide" />
      <div className="sacp__skeleton-row sacp__skeleton-row--narrow" />
      <div className="sacp__skeleton-group-label sacp__skeleton-group-label--mt" />
      <div className="sacp__skeleton-row sacp__skeleton-row--mid" />
    </div>
  );
}

const GROUP_CONFIG = {
  owners: { label: 'Owners', Icon: Building2, mod: 'owner' },
  stores: { label: 'Stores', Icon: Store, mod: 'store' },
  employees: { label: 'Employees', Icon: Users, mod: 'employee' },
} as const;

type GroupKey = keyof typeof GROUP_CONFIG;

function ResultGroup({
  groupKey,
  items,
  onSelect,
}: {
  groupKey: GroupKey;
  items: SASearchItem[];
  onSelect: (item: SASearchItem) => void;
}) {
  if (items.length === 0) return null;
  const { label, Icon, mod } = GROUP_CONFIG[groupKey];
  return (
    <div className="sacp__group">
      <div className="sacp__group-label">
        <Icon size={10} aria-hidden="true" />
        {label}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="sacp__item"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          <span className={`sacp__item-badge sacp__item-badge--${mod}`}>
            <Icon size={12} aria-hidden="true" />
          </span>
          <span className="sacp__item-text">
            <span className="sacp__item-label">{item.label}</span>
            {item.subtitle && <span className="sacp__item-sub">{item.subtitle}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function SearchResults({
  query,
  results,
  loading,
  onSelect,
}: {
  query: string;
  results: SASearchResponse;
  loading: boolean;
  onSelect: (item: SASearchItem) => void;
}) {
  const hasResults =
    results.owners.length > 0 || results.stores.length > 0 || results.employees.length > 0;

  if (loading) return <SkeletonResults />;
  if (!hasResults) {
    return (
      <div className="sacp__empty">
        <Search size={18} aria-hidden="true" />
        <span>No results for "{query}"</span>
      </div>
    );
  }
  return (
    <>
      <ResultGroup groupKey="owners" items={results.owners} onSelect={onSelect} />
      <ResultGroup groupKey="stores" items={results.stores} onSelect={onSelect} />
      <ResultGroup groupKey="employees" items={results.employees} onSelect={onSelect} />
    </>
  );
}

function SACommandPalette({ onNavigate }: SACommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SASearchResponse>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    superAdminSearch(debouncedQuery)
      .then(setResults)
      .catch(() => setResults(EMPTY))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  useEffect(() => {
    if (mobileOpen) {
      const id = setTimeout(() => mobileInputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    } else {
      setQuery('');
      setResults(EMPTY);
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  function handleSelect(item: SASearchItem) {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    setResults(EMPTY);
    onNavigate(item.navTarget);
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <>
      {/* Desktop: full inline search bar */}
      <div className="sacp" ref={containerRef}>
        <div className="sacp__input-wrap">
          <Search className="sacp__search-icon" size={14} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="sacp__input"
            placeholder="Search owners, stores, employees…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            aria-label="Platform search"
            autoComplete="off"
          />
        </div>

        {showDropdown && (
          <div className="sacp__dropdown" role="listbox" aria-label="Search results">
            <SearchResults
              query={query}
              results={results}
              loading={loading}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>

      {/* Mobile: lens icon only */}
      <button
        type="button"
        className="sacp__mobile-trigger"
        aria-label="Open search"
        onClick={() => setMobileOpen(true)}
      >
        <Search size={18} aria-hidden="true" />
      </button>

      {/* Mobile: full-screen search overlay */}
      {mobileOpen && (
        <div
          className="sacp__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="sacp__overlay-header">
            <button
              type="button"
              className="sacp__overlay-back"
              aria-label="Close search"
              onClick={() => setMobileOpen(false)}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div className="sacp__overlay-input-wrap">
              <Search className="sacp__search-icon sacp__search-icon--overlay" size={14} aria-hidden="true" />
              <input
                ref={mobileInputRef}
                type="search"
                className="sacp__input sacp__input--overlay"
                placeholder="Search owners, stores, employees…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Platform search"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="sacp__overlay-body">
            {query.trim() ? (
              <SearchResults
                query={query}
                results={results}
                loading={loading}
                onSelect={handleSelect}
              />
            ) : (
              <div className="sacp__overlay-hint">
                <Search size={28} aria-hidden="true" />
                <span>Search owners, stores, and employees</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default SACommandPalette;
