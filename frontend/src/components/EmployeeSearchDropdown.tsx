import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ClipboardList, MessageSquareWarning, Search } from 'lucide-react';
import { employeeSearch, type EmployeeSearchItem, type EmployeeSearchResponse } from '../api/employeeSearch';
import './EmployeeSearchDropdown.css';

interface EmployeeSearchDropdownProps {
  storeId: number;
  onNavigate: (target: 'today' | 'issues') => void;
}

const EMPTY: EmployeeSearchResponse = { tasks: [], issues: [] };

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
    <div className="edrop__skeleton" aria-hidden="true">
      <div className="edrop__skeleton-group-label" />
      <div className="edrop__skeleton-row edrop__skeleton-row--wide" />
      <div className="edrop__skeleton-row edrop__skeleton-row--narrow" />
      <div className="edrop__skeleton-group-label edrop__skeleton-group-label--mt" />
      <div className="edrop__skeleton-row edrop__skeleton-row--mid" />
    </div>
  );
}

const GROUP_CONFIG = {
  tasks: { label: 'Tasks', Icon: ClipboardList, mod: 'task' },
  issues: { label: 'My Issues', Icon: MessageSquareWarning, mod: 'issue' },
} as const;

type GroupKey = keyof typeof GROUP_CONFIG;

function ResultGroup({
  groupKey,
  items,
  onSelect,
}: {
  groupKey: GroupKey;
  items: EmployeeSearchItem[];
  onSelect: () => void;
}) {
  if (items.length === 0) return null;
  const { label, Icon, mod } = GROUP_CONFIG[groupKey];
  return (
    <div className="edrop__group">
      <div className="edrop__group-label">
        <Icon size={10} aria-hidden="true" />
        {label}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="edrop__item"
          onMouseDown={(e) => { e.preventDefault(); onSelect(); }}
        >
          <span className={`edrop__item-badge edrop__item-badge--${mod}`}>
            <Icon size={12} aria-hidden="true" />
          </span>
          <span className="edrop__item-text">
            <span className="edrop__item-label">{item.label}</span>
            {item.subtitle && <span className="edrop__item-sub">{item.subtitle}</span>}
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
  onNavigate,
}: {
  query: string;
  results: EmployeeSearchResponse;
  loading: boolean;
  onNavigate: (target: 'today' | 'issues') => void;
}) {
  const hasResults = results.tasks.length > 0 || results.issues.length > 0;
  if (loading) return <SkeletonResults />;
  if (!hasResults) {
    return (
      <div className="edrop__empty">
        <Search size={18} aria-hidden="true" />
        <span>No results for "{query}"</span>
      </div>
    );
  }
  return (
    <>
      <ResultGroup groupKey="tasks" items={results.tasks} onSelect={() => onNavigate('today')} />
      <ResultGroup groupKey="issues" items={results.issues} onSelect={() => onNavigate('issues')} />
    </>
  );
}

function EmployeeSearchDropdown({ storeId, onNavigate }: EmployeeSearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmployeeSearchResponse>(EMPTY);
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
    employeeSearch(storeId, debouncedQuery)
      .then(setResults)
      .catch(() => setResults(EMPTY))
      .finally(() => setLoading(false));
  }, [debouncedQuery, storeId]);

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
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
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

  function handleNavigate(target: 'today' | 'issues') {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    setResults(EMPTY);
    onNavigate(target);
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <>
      {/* Desktop: full inline search */}
      <div className="edrop" ref={containerRef}>
        <div className="edrop__input-wrap">
          <Search className="edrop__search-icon" size={14} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="edrop__input"
            placeholder="Search tasks or issues…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            aria-label="Search tasks and issues"
            autoComplete="off"
          />
        </div>
        {showDropdown && (
          <div className="edrop__dropdown" role="listbox" aria-label="Search results">
            <SearchResults
              query={query}
              results={results}
              loading={loading}
              onNavigate={handleNavigate}
            />
          </div>
        )}
      </div>

      {/* Mobile: lens icon */}
      <button
        type="button"
        className="edrop__mobile-trigger"
        aria-label="Open search"
        onClick={() => setMobileOpen(true)}
      >
        <Search size={18} aria-hidden="true" />
      </button>

      {/* Mobile: full-screen overlay */}
      {mobileOpen && (
        <div className="edrop__overlay" role="dialog" aria-modal="true" aria-label="Search">
          <div className="edrop__overlay-header">
            <button
              type="button"
              className="edrop__overlay-back"
              aria-label="Close search"
              onClick={() => setMobileOpen(false)}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div className="edrop__overlay-input-wrap">
              <Search className="edrop__search-icon edrop__search-icon--overlay" size={14} aria-hidden="true" />
              <input
                ref={mobileInputRef}
                type="search"
                className="edrop__input edrop__input--overlay"
                placeholder="Search tasks or issues…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search tasks and issues"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="edrop__overlay-body">
            {query.trim() ? (
              <SearchResults
                query={query}
                results={results}
                loading={loading}
                onNavigate={handleNavigate}
              />
            ) : (
              <div className="edrop__overlay-hint">
                <Search size={28} aria-hidden="true" />
                <span>Search today's tasks and your raised issues</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeeSearchDropdown;
