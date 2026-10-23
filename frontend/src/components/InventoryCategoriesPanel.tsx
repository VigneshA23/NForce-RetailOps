import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { CircleCheck, CornerDownRight, ChevronDown, ChevronRight, Pencil, Plus, Store as StoreIcon, Tags, Trash2 } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { createInventoryCategory, deleteInventoryCategory, setInventoryCategoryActive, updateInventoryCategory } from '../api/inventoryCategories';
import type { InventoryCategoryFormValues, InventoryCategoryRecord } from '../types/inventoryCategory';
import type { StoreInventoryItem } from '../types/storeInventory';
import { useIsMobile } from '../hooks/useMediaQuery';
import StatCard from './StatCard';
import Select from './Select';
import SearchInput from './SearchInput';
import FilterClearButton from './FilterClearButton';
import ConfirmDialog from './ConfirmDialog';
import SpecularButton from './SpecularButton';
import UserAvatar from './UserAvatar';
import Toggle from './Toggle';
import InventoryCategoryFormModal from './InventoryCategoryFormModal';

interface StoreOption {
  id: number;
  name: string;
}

interface InventoryCategoriesPanelProps {
  stores: StoreOption[];
  items: StoreInventoryItem[];
  // Owned by the parent page (fetched alongside suppliers/stores/items) so
  // the catalog is available for the Inventory tab's item-form category
  // picker even before this tab is ever opened -- this tab only renders
  // when selected, same as the Suppliers tab owning `suppliers` itself.
  categories: InventoryCategoryRecord[];
  setCategories: Dispatch<SetStateAction<InventoryCategoryRecord[]>>;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  // Jumps to the Inventory sub-tab with that store selected, mirroring the
  // Suppliers tab's own "View Items" link.
  onViewStoreItems?: (storeId: number) => void;
}

type CategoryModalState = { mode: 'create' } | { mode: 'edit'; category: InventoryCategoryRecord } | null;

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

// Super Admin's own Category catalog -- same table/search/filter/modal shape
// as the Suppliers sub-tab in SuperAdminInventory.tsx (same table CSS
// classes, reused rather than duplicated), kept as its own component so that
// already-large file doesn't grow further -- same pattern as
// StockLevelComparison/SuperAdminStockCheckHistory being their own sub-tab
// components instead of inlined.
function InventoryCategoriesPanel({ stores, items, categories, setCategories, isLoading, loadError, onRetry, onViewStoreItems }: InventoryCategoriesPanelProps) {
  const isMobile = useIsMobile();

  const activeCount = useMemo(() => categories.filter((c) => c.active).length, [categories]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const visibleCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (normalizedSearch && !category.name.toLowerCase().includes(normalizedSearch)) return false;
      if (statusFilter === 'ACTIVE' && !category.active) return false;
      if (statusFilter === 'INACTIVE' && category.active) return false;
      return true;
    });
  }, [categories, search, statusFilter]);

  // Items Count column: total items per category (matched by name,
  // case-insensitive -- an item's own category is a free-text field, not a
  // foreign key), plus a per-store breakdown for the expand row -- computed
  // client-side from the already-loaded items list, same as itemsBySupplier.
  const itemsByCategory = useMemo(() => {
    const byCategory = new Map<string, Map<number, { storeName: string; count: number }>>();
    for (const item of items) {
      if (!item.category) continue;
      const key = item.category.trim().toLowerCase();
      let byStore = byCategory.get(key);
      if (!byStore) {
        byStore = new Map();
        byCategory.set(key, byStore);
      }
      const existing = byStore.get(item.storeId);
      if (existing) {
        existing.count += 1;
      } else {
        byStore.set(item.storeId, { storeName: item.storeName, count: 1 });
      }
    }
    return byCategory;
  }, [items]);

  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<number>>(new Set());

  function toggleExpanded(categoryId: number) {
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: InventoryCategoryFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (categoryModal?.mode === 'edit') {
        const updated = await updateInventoryCategory(categoryModal.category.id, values);
        setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
        nfToast.success(`"${updated.name}" category updated.`);
      } else {
        const created = await createInventoryCategory(values);
        setCategories((current) => [...current, created]);
        nfToast.success(`"${created.name}" category added.`);
      }
      setCategoryModal(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(category: InventoryCategoryRecord, active: boolean) {
    setCategories((current) => current.map((c) => (c.id === category.id ? { ...c, active } : c)));
    try {
      const updated = await setInventoryCategoryActive(category.id, active);
      setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
      nfToast.success(`"${category.name}" category ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setCategories((current) => current.map((c) => (c.id === category.id ? category : c)));
      nfToast.error(error instanceof Error ? error.message : 'Failed to update category status');
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<InventoryCategoryRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const target = deleteTarget;
    try {
      const result = await deleteInventoryCategory(target.id);
      if (result.deleted) {
        setCategories((current) => current.filter((c) => c.id !== target.id));
        nfToast.success(`"${target.name}" category deleted.`);
      } else {
        setCategories((current) => current.map((c) => (c.id === target.id ? { ...c, active: false } : c)));
        nfToast.success(`"${target.name}" is used by existing items, so it was deactivated instead of deleted.`);
      }
      setDeleteTarget(null);
    } catch (error) {
      setDeleteTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to delete category';
      setDeleteError(msg);
      nfToast.error(msg);
    }
  }

  if (loadError) {
    return (
      <div className="table-card">
        <div className="owners-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="stat-card-row">
        <StatCard icon={Tags} label="Categories" value={categories.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active" value={activeCount} tone="success" />
      </div>
      <div className="super-admin-inventory-page__header">
        <p className="super-admin-inventory-page__summary">
          {isLoading ? 'Loading...' : `${activeCount} active of ${categories.length} total`}
        </p>
        <SpecularButton
          size="sm"
          radius={999}
          tint="var(--color-badge-solid-bg)"
          tintOpacity={1}
          textColor="var(--color-badge-solid-text)"
          lineColor="#e11d33"
          baseColor="#e4e4e7"
          followMouse
          proximity={180}
          onClick={() => { setFormError(null); setCategoryModal({ mode: 'create' }); }}
        >
          <span className="super-admin-inventory-page__add-label">
            <Plus size={16} />
            Add Category
          </span>
        </SpecularButton>
      </div>

      <div className="filter-bar store-inventory-page__supplier-filter-bar">
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
        <FilterClearButton onClick={() => { setSearch(''); setStatusFilter('ALL'); }} />
      </div>

      {!isMobile && (
        <div className="table-card supplier-table-card">
          <div className="table-scroll">
            <table className="data-table">
              <colgroup>
                <col className="supplier-table__col-name" />
                <col className="supplier-table__col-store" />
                <col className="supplier-table__col-count" />
                <col className="supplier-table__col-status" />
                <col className="supplier-table__col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Category Name</th>
                  <th scope="col">Assigned Store</th>
                  <th scope="col" className="super-admin-inventory-page__count-cell">Items Count</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="super-admin-inventory-page__actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCategories.map((category) => {
                  const byStore = itemsByCategory.get(category.name.trim().toLowerCase());
                  const storeBreakdown = byStore
                    ? [...byStore.entries()]
                        .map(([storeId, s]) => ({ storeId, storeName: s.storeName, count: s.count }))
                        .sort((a, b) => a.storeName.localeCompare(b.storeName))
                    : [];
                  const totalItems = storeBreakdown.reduce((sum, s) => sum + s.count, 0);
                  const isExpanded = expandedCategoryIds.has(category.id);
                  return (
                    <Fragment key={category.id}>
                      <tr
                        className="super-admin-inventory-page__supplier-row"
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(category.id)}
                      >
                        <td className="supplier-table__cell-name" data-label="Category Name">
                          <div className="super-admin-inventory-page__supplier-name-cell inventory-categories-page__name-cell">
                            <ChevronDown
                              size={16}
                              className={`super-admin-inventory-page__supplier-chevron${isExpanded ? '' : ' super-admin-inventory-page__supplier-chevron--collapsed'}`}
                            />
                            <UserAvatar initials={category.name.charAt(0).toUpperCase()} size={28} />
                            <div className="super-admin-inventory-page__supplier-name">{category.name}</div>
                          </div>
                        </td>
                        <td className="supplier-table__cell-store" data-label="Assigned Store">
                          {category.appliesToAllStores ? (
                            <span className="employee-table__store-badge">All Stores</span>
                          ) : category.stores.length === 0 ? (
                            <span className="employee-table__no-stores">—</span>
                          ) : (
                            <div className="employee-table__store-badges">
                              {category.stores.map((store) => (
                                <span key={store.id} className="employee-table__store-badge">{store.name}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td data-label="Items Count" className="super-admin-inventory-page__count-cell supplier-table__cell-count">
                          {totalItems}
                        </td>
                        <td className="supplier-table__cell-status" data-label="Status" onClick={(event) => event.stopPropagation()}>
                          <Toggle
                            checked={category.active}
                            onChange={(checked) => handleToggleActive(category, checked)}
                            label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                          />
                        </td>
                        <td className="table-actions-cell" data-label="Actions" onClick={(event) => event.stopPropagation()}>
                          <div className="table-row-actions">
                            <button
                              type="button"
                              className="table-icon-btn"
                              aria-label={`Edit ${category.name}`}
                              title="Edit"
                              onClick={() => { setFormError(null); setCategoryModal({ mode: 'edit', category }); }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="table-icon-btn table-icon-btn--danger"
                              aria-label={`Delete ${category.name}`}
                              title="Delete"
                              onClick={() => { setDeleteError(null); setDeleteTarget(category); }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        storeBreakdown.length === 0 ? (
                          <tr className="super-admin-inventory-page__breakdown-row">
                            <td colSpan={5}>
                              <span className="super-admin-inventory-page__breakdown-empty">Not used by any store yet.</span>
                            </td>
                          </tr>
                        ) : (
                          storeBreakdown.map((s) => (
                            <tr key={s.storeId} className="super-admin-inventory-page__breakdown-row">
                              <td colSpan={2} data-label="Store">
                                <div className="super-admin-inventory-page__breakdown-store">
                                  <CornerDownRight size={13} className="supplier-table__breakdown-connector" />
                                  <span className="supplier-table__store-icon">
                                    <StoreIcon size={13} />
                                  </span>
                                  {s.storeName}
                                </div>
                              </td>
                              <td data-label="Items Count" className="super-admin-inventory-page__count-cell">{s.count}</td>
                              <td />
                              <td className="table-actions-cell">
                                {onViewStoreItems && (
                                  <button
                                    type="button"
                                    className="super-admin-inventory-page__view-items"
                                    onClick={() => onViewStoreItems(s.storeId)}
                                  >
                                    View Items
                                    <ChevronRight size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!isLoading && visibleCategories.length === 0 && (
            <div className="super-admin-inventory-page__empty">
              {categories.length === 0 ? 'No categories yet.' : 'No categories match these filters.'}
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <div className="supplier-mobile-list">
          {visibleCategories.map((category) => {
            const byStore = itemsByCategory.get(category.name.trim().toLowerCase());
            const storeBreakdown = byStore
              ? [...byStore.entries()]
                  .map(([storeId, s]) => ({ storeId, storeName: s.storeName, count: s.count }))
                  .sort((a, b) => a.storeName.localeCompare(b.storeName))
              : [];
            const totalItems = storeBreakdown.reduce((sum, s) => sum + s.count, 0);
            const isExpanded = expandedCategoryIds.has(category.id);
            return (
              <div className="supplier-mobile-card" key={category.id}>
                <div className="supplier-mobile-card__top">
                  <UserAvatar initials={category.name.charAt(0).toUpperCase()} size={44} />
                  <div className="supplier-mobile-card__main">
                    <div className="supplier-mobile-card__name">{category.name}</div>
                    <div className="supplier-mobile-card__count">{totalItems} Items</div>
                  </div>
                  <div className="supplier-mobile-card__side">
                    <Toggle
                      checked={category.active}
                      onChange={(checked) => handleToggleActive(category, checked)}
                      label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                    />
                    <div className="supplier-mobile-card__actions">
                      <button
                        type="button"
                        className="table-icon-btn"
                        aria-label={`Edit ${category.name}`}
                        title="Edit"
                        onClick={() => { setFormError(null); setCategoryModal({ mode: 'edit', category }); }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn--danger"
                        aria-label={`Delete ${category.name}`}
                        title="Delete"
                        onClick={() => { setDeleteError(null); setDeleteTarget(category); }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="supplier-mobile-card__footer">
                  <span className="supplier-mobile-card__store-value">
                    <StoreIcon size={12} />
                    {category.appliesToAllStores ? 'All Stores' : category.stores.length === 1 ? category.stores[0].name : category.stores.length === 0 ? '—' : `${category.stores.length} Stores`}
                  </span>
                  <button type="button" className="supplier-mobile-card__details-toggle" onClick={() => toggleExpanded(category.id)}>
                    {isExpanded ? 'Hide Details' : 'Show Details'}
                    <ChevronDown size={14} className={isExpanded ? 'supplier-mobile-card__chevron--up' : undefined} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="supplier-mobile-card__breakdown">
                    {storeBreakdown.length === 0 ? (
                      <span className="super-admin-inventory-page__breakdown-empty">Not used by any store yet.</span>
                    ) : (
                      storeBreakdown.map((s) => (
                        <div key={s.storeId} className="supplier-mobile-card__breakdown-row">
                          <span className="supplier-mobile-card__breakdown-name">{s.storeName}</span>
                          {onViewStoreItems && (
                            <button type="button" className="super-admin-inventory-page__view-items" onClick={() => onViewStoreItems(s.storeId)}>
                              View Items
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && visibleCategories.length === 0 && (
            <div className="super-admin-inventory-page__empty">
              {categories.length === 0 ? 'No categories yet.' : 'No categories match these filters.'}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Category"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? If items still use it, it will be deactivated instead. This cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {deleteError && <div className="owners-page__error">{deleteError}</div>}

      <InventoryCategoryFormModal
        isOpen={categoryModal !== null}
        mode={categoryModal?.mode ?? 'create'}
        availableStores={stores}
        initialValues={
          categoryModal?.mode === 'edit'
            ? {
                name: categoryModal.category.name,
                appliesToAllStores: categoryModal.category.appliesToAllStores,
                storeIds: categoryModal.category.stores.map((s) => s.id),
              }
            : undefined
        }
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setCategoryModal(null)}
        onSubmit={handleSubmit}
      />
    </>
  );
}

export default InventoryCategoriesPanel;
