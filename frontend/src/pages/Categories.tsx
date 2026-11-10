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
import Pagination from '../components/Pagination';
import './Categories.css';

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(1);

  // Back to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

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

  const pageCount = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedCategories = filteredCategories.slice(pageStart, pageStart + PAGE_SIZE);

  // The table only shows one page, so it hands back that page's new order;
  // splice it into the full (unfiltered) list at the same position.
  async function handleReorder(pageOrderedIds: number[]) {
    const orderedIds = [
      ...categories.slice(0, pageStart).map((category) => category.id),
      ...pageOrderedIds,
      ...categories.slice(pageStart + pageOrderedIds.length).map((category) => category.id),
    ];
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
            <FilterClearButton onClick={() => setStatusFilter('ALL')} />
          </div>

          {!canReorder && !isLoading && categories.length > 0 && (
            <p className="categories-page__reorder-hint">Clear filters to reorder categories.</p>
          )}

          <CategoryTable
            categories={pagedCategories}
            canManage={false}
            canReorder={canReorder && !isReordering}
            onReorder={handleReorder}
            isLoading={isLoading}
            footer={
              !isLoading && filteredCategories.length > 0 ? (
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  totalItems={filteredCategories.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                  itemLabel="categories"
                />
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}

export default Categories;
