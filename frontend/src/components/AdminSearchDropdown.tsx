import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ClipboardList, Layers, Search, Users } from 'lucide-react';
import { adminSearch, type AdminSearchItem, type AdminSearchResponse } from '../api/adminSearch';
import './AdminSearchDropdown.css';

interface AdminSearchDropdownProps {
  onNavigate: (group: 'tasks' | 'categories' | 'employees', term: string) => void;
}

const EMPTY: AdminSearchResponse = { tasks: [], categories: [], employees: [] };

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
    <div className="adrop__skeleton" aria-hidden="true">
      <div className="adrop__skeleton-group-label" />
      <div className="adrop__skeleton-row adrop__skeleton-row--wide" />
      <div className="adrop__skeleton-row adrop__skeleton-row--narrow" />
      <div className="adrop__skeleton-group-label adrop__skeleton-group-label--mt" />
      <div className="adrop__skeleton-row adrop__skeleton-row--mid" />
    </div>
  );
}

const GROUP_CONFIG = {
  tasks: { label: 'Tasks', Icon: ClipboardList, mod: 'task' },
  categories: { label: 'Categories', Icon: Layers, mod: 'category' },
  employees: { label: 'Employees', Icon: Users, mod: 'employee' },
} as const;

type GroupKey = keyof typeof GROUP_CONFIG;

function ResultGroup({
  groupKey,
  items,
  onSelect,
}: {
  groupKey: GroupKey;
  items: AdminSearchItem[];
  onSelect: (item: AdminSearchItem) => void;
}) {
  if (items.length === 0) return null;
  const { label, Icon, mod } = GROUP_CONFIG[groupKey];
  return (
    <div className="adrop__group">
      <div className="adrop__group-label">
        <Icon size={10} aria-hidden="true" />
        {label}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="adrop__item"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          <span className={`adrop__item-badge adrop__item-badge--${mod}`}>
            <Icon size={12} aria-hidden="true" />
          </span>
          <span className="adrop__item-text">
            <span className="adrop__item-label">{item.label}</span>
            {item.subtitle && <span className="adrop__item-sub">{item.subtitle}</span>}
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
  results: AdminSearchResponse;
  loading: boolean;
  onNavigate: (group: 'tasks' | 'categories' | 'employees', term: string) => void;
}) {
  const hasResults =
    results.tasks.length > 0 || results.categories.length > 0 || results.employees.length > 0;

  if (loading) return <SkeletonResults />;
  if (!hasResults) {
    return (
      <div className="adrop__empty">
        <Search size={18} aria-hidden="true" />
        <span>No results for "{query}"</span>
      </div>
    );
  }
  return (
    <>
      <ResultGroup
        groupKey="tasks"
        items={results.tasks}
        onSelect={(item) => onNavigate('tasks', item.label)}
      />
      <ResultGroup
        groupKey="categories"
        items={results.categories}
        onSelect={(item) => onNavigate('categories', item.label)}
      />
      <ResultGroup
        groupKey="employees"
        items={results.employees}
        onSelect={(item) => onNavigate('employees', item.label)}
      />
    </>
  );
}

function AdminSearchDropdown({ onNavigate }: AdminSearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminSearchResponse>(EMPTY);
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
    adminSearch(debouncedQuery)
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

  function handleNavigate(group: 'tasks' | 'categories' | 'employees', term: string) {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    setResults(EMPTY);
    onNavigate(group, term);
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <>
      {/* Desktop: full inline search bar */}
      <div className="adrop" ref={containerRef}>
        <div className="adrop__input-wrap">
          <Search className="adrop__search-icon" size={14} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="adrop__input"
            placeholder="Search tasks, categories, employees…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            aria-label="Store search"
            autoComplete="off"
          />
        </div>

        {showDropdown && (
          <div className="adrop__dropdown" role="listbox" aria-label="Search results">
            <SearchResults
              query={query}
              results={results}
              loading={loading}
              onNavigate={handleNavigate}
            />
          </div>
        )}
      </div>

      {/* Mobile: lens icon only */}
      <button
        type="button"
        className="adrop__mobile-trigger"
        aria-label="Open search"
        onClick={() => setMobileOpen(true)}
      >
        <Search size={18} aria-hidden="true" />
      </button>

      {/* Mobile: full-screen search overlay */}
      {mobileOpen && (
        <div
          className="adrop__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="adrop__overlay-header">
            <button
              type="button"
              className="adrop__overlay-back"
              aria-label="Close search"
              onClick={() => setMobileOpen(false)}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div className="adrop__overlay-input-wrap">
              <Search className="adrop__search-icon adrop__search-icon--overlay" size={14} aria-hidden="true" />
              <input
                ref={mobileInputRef}
                type="search"
                className="adrop__input adrop__input--overlay"
                placeholder="Search tasks, categories, employees…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Store search"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="adrop__overlay-body">
            {query.trim() ? (
              <SearchResults
                query={query}
                results={results}
                loading={loading}
                onNavigate={handleNavigate}
              />
            ) : (
              <div className="adrop__overlay-hint">
                <Search size={28} aria-hidden="true" />
                <span>Search tasks, categories, and employees</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AdminSearchDropdown;
