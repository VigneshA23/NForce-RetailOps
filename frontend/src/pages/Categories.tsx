import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Tags, CircleCheck, CircleSlash } from 'lucide-react';
import type { Category } from '../types/category';
import { reorderCategories } from '../api/categories';
import { nfToast } from '../utils/toast';
import CategoryTable from '../components/CategoryTable';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import FilterClearButton from '../components/FilterClearButton';
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

// Read-only for Owner Admin except for reordering: category creation,
// editing, activation, and deletion are Super-Admin-only, but this owner can
// drag-and-drop to change the display order of whichever categories apply to
// their store(s), including ones Super Admin created and assigned.
function Categories({ categories, setCategories, isLoading, loadError, onRetry, searchSeed }: CategoriesProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [isReordering, setIsReordering] = useState(false);

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

  // Reordering only makes sense against the full, unfiltered list -- with a
  // search term or status filter applied, "move up" would be ambiguous
  // relative to categories hidden by the filter.
  const canReorder = statusFilter === 'ALL' && search.trim() === '';

  async function handleReorder(orderedIds: number[]) {
    const previous = categories;
    const byId = new Map(previous.map((category) => [category.id, category]));
    setCategories(orderedIds.map((id) => byId.get(id)).filter((c): c is Category => c !== undefined));
    setIsReordering(true);
    try {
      const updated = await reorderCategories(orderedIds);
      setCategories(updated);
    } catch (error) {
      setCategories(previous);
      nfToast.error(error instanceof Error ? error.message : 'Failed to save the new category order');
    } finally {
      setIsReordering(false);
    }
  }

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
            {statusFilter !== 'ALL' && (
              <FilterClearButton onClick={() => setStatusFilter('ALL')} />
            )}
          </div>

          {!canReorder && !isLoading && categories.length > 0 && (
            <p className="categories-page__reorder-hint">Clear filters to reorder categories.</p>
          )}

          <CategoryTable
            categories={filteredCategories}
            canManage={false}
            canReorder={canReorder && !isReordering}
            onReorder={handleReorder}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}

export default Categories;
