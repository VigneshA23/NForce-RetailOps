import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Tags, CircleCheck, CircleSlash } from 'lucide-react';
import type { Category } from '../types/category';
import CategoryTable from '../components/CategoryTable';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import StatCard from '../components/StatCard';
import './Categories.css';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface CategoriesProps {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  searchSeed?: { term: string; id: number };
}

// Read-only for Owner Admin: category creation, editing, activation, and
// deletion are Super-Admin-only. This page shows whichever categories apply
// to this owner's store(s), including ones Super Admin created and assigned.
function Categories({ categories, isLoading, loadError, onRetry, searchSeed }: CategoriesProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const appliedSeedId = useRef<number | null>(null);
  useEffect(() => {
    if (searchSeed && searchSeed.id !== appliedSeedId.current) {
      appliedSeedId.current = searchSeed.id;
      setSearch(searchSeed.term);
    }
  }, [searchSeed]);

  const activeCount = useMemo(() => categories.filter((category) => category.active).length, [categories]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (normalizedSearch && !category.name.toLowerCase().includes(normalizedSearch)) return false;
      if (statusFilter === 'ACTIVE' && !category.active) return false;
      if (statusFilter === 'INACTIVE' && category.active) return false;
      return true;
    });
  }, [categories, search, statusFilter]);

  return (
    <div className="categories-page">
      <div className="stat-card-row">
        <StatCard icon={Tags} label="Total Categories" value={categories.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active" value={activeCount} tone="success" />
        <StatCard icon={CircleSlash} label="Inactive" value={categories.length - activeCount} tone="warning" />
      </div>

      <div className="categories-page__header">
        <p className="categories-page__summary">
          {isLoading
            ? 'Loading categories...'
            : `${activeCount} active categor${activeCount === 1 ? 'y' : 'ies'} of ${categories.length} total`}
        </p>
      </div>

      {loadError ? (
        <div className="categories-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <div className="filter filter--search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search categories" variant="filter" />
            </div>
            <Select
              className="filter filter--narrow"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              ariaLabel="Filter by status"
            />
          </div>

          <CategoryTable categories={filteredCategories} canManage={false} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}

export default Categories;
