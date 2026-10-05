import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Boxes, CircleCheck, Clock, FileSpreadsheet, FileText, Package, PackageX, Plus } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createStoreInventoryItem,
  deleteStoreInventoryItem,
  getStoreInventoryItems,
  setStoreInventoryItemActive,
  updateStoreInventoryItem,
} from '../api/storeInventory';
import { findOrCreateSupplier, getOwnerSuppliers } from '../api/suppliers';
import { findOrCreateCategory, getOwnerCategories } from '../api/inventoryCategories';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import type { InventoryCategory } from '../types/inventoryCategory';
import StoreInventoryItemFormModal from '../components/StoreInventoryItemFormModal';
import StoreInventoryItemEditPanel from '../components/StoreInventoryItemEditPanel';
import StoreInventoryCardGrid from '../components/StoreInventoryCardGrid';
import ConfirmDialog from '../components/ConfirmDialog';
import StockCheckHistory from '../components/StockCheckHistory';
import SearchInput from '../components/SearchInput';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import Select from '../components/Select';
import FilterClearButton from '../components/FilterClearButton';
import useDismissablePanel from '../hooks/useDismissablePanel';
import { getStockStatus } from '../utils/storeInventoryStatus';
import { exportInventoryCatalogCsv, exportInventoryCatalogPdf } from '../utils/inventoryCatalogExport';
import './StoreInventory.css';

type SubTab = 'items' | 'history';

const SUB_TABS: { key: SubTab; label: string; icon: typeof Package }[] = [
  { key: 'items', label: 'Items', icon: Package },
  { key: 'history', label: 'History', icon: Clock },
];

type SortOption = 'name' | 'status' | 'supplier' | 'category';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Sort: Category & Name' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'supplier', label: 'Sort: Supplier' },
  { value: 'category', label: 'Sort: Category' },
];

const STATUS_SORT_ORDER = { low: 0, out: 1, in: 2, inactive: 3 } as const;

function StoreInventory() {
  const [subTab, setSubTab] = useState<SubTab>('items');
  const [historyTotal, setHistoryTotal] = useState(0);
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('name');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useDismissablePanel({ isOpen: isExportMenuOpen, onClose: () => setIsExportMenuOpen(false), refs: [exportMenuRef] });

  // Add uses a centered modal; Edit opens the item in a right-side sliding
  // panel instead -- different enough UIs (see mockups) to keep as separate
  // state rather than one "mode" flag.
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StoreInventoryItem | null>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreInventoryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getStoreInventoryItems(), getOwnerSuppliers(), getOwnerCategories()])
      .then(([its, sups, cats]) => {
        setItems(its);
        setSuppliers(sups);
        setCategories(cats);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // 60-second silent refresh so "Current Available" picks up counts as
  // employees submit today's stock check. A failed poll keeps the last list.
  useEffect(() => {
    const id = window.setInterval(() => {
      getStoreInventoryItems().then(setItems).catch(() => {});
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Keep the open edit panel's own item reference fresh across that same
  // poll (e.g. its "Current Available" or active flag), without resetting
  // whatever the owner is mid-typing -- StoreInventoryItemEditPanel only
  // resets its form when item.id itself changes.
  useEffect(() => {
    if (!editTarget) return;
    const fresh = items.find((i) => i.id === editTarget.id);
    if (fresh && fresh !== editTarget) {
      setEditTarget(fresh);
    }
  }, [items, editTarget]);

  // Inline "Add New Supplier" from the item form: persist it, then merge it
  // into the local directory so it's selectable for every later item too.
  async function handleCreateSupplier(name: string): Promise<Supplier> {
    const supplier = await findOrCreateSupplier(name);
    setSuppliers((current) =>
      (current.some((s) => s.id === supplier.id)
        ? current.map((s) => (s.id === supplier.id ? supplier : s))
        : [...current, supplier]
      ).sort((a, b) => a.name.localeCompare(b.name)),
    );
    nfToast.success(`"${supplier.name}" supplier added.`);
    return supplier;
  }

  // Inline "Add New Category" from the item form: persist it, then merge it
  // into the local directory so it's selectable for every later item too.
  async function handleCreateCategory(name: string): Promise<InventoryCategory> {
    const category = await findOrCreateCategory(name);
    setCategories((current) =>
      (current.some((c) => c.id === category.id)
        ? current.map((c) => (c.id === category.id ? category : c))
        : [...current, category]
      ).sort((a, b) => a.name.localeCompare(b.name)),
    );
    nfToast.success(`"${category.name}" category added.`);
    return category;
  }

  async function handleCreateSubmit(values: StoreInventoryItemFormValues) {
    setItemFormError(null);
    setIsItemSubmitting(true);
    try {
      const created = await createStoreInventoryItem(values);
      setItems((current) => [...current, created]);
      nfToast.success(`"${created.name}" added.`);
      setIsCreateModalOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setItemFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsItemSubmitting(false);
    }
  }

  async function handleEditSubmit(values: StoreInventoryItemFormValues) {
    if (!editTarget) return;
    setItemFormError(null);
    setIsItemSubmitting(true);
    try {
      const updated = await updateStoreInventoryItem(editTarget.id, values);
      setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
      nfToast.success(`"${updated.name}" updated.`);
      setEditTarget(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setItemFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsItemSubmitting(false);
    }
  }

  async function handleToggleStatus(item: StoreInventoryItem, active: boolean) {
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, active } : i)));
    try {
      const updated = await setStoreInventoryItemActive(item.id, active);
      setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
      nfToast.success(`"${item.name}" ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setItems((current) => current.map((i) => (i.id === item.id ? item : i)));
      nfToast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteStoreInventoryItem(deleteTarget.id);
      setItems((current) => current.filter((i) => i.id !== deleteTarget.id));
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      nfToast.success(`"${deletedName}" deleted.`);
    } catch (error) {
      setDeleteTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to delete inventory item';
      setDeleteError(msg);
      nfToast.error(msg);
    }
  }

  const activeCount = useMemo(() => items.filter((i) => i.active).length, [items]);
  const lowStockCount = useMemo(() => items.filter((i) => getStockStatus(i) === 'low').length, [items]);
  const outOfStockCount = useMemo(() => items.filter((i) => getStockStatus(i) === 'out').length, [items]);

  const distinctCategories = useMemo(
    () => [...new Set(items.map((i) => i.categoryName).filter((name): name is string => !!name))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filteredItems = items.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.name.toLowerCase().includes(term) ||
      (item.categoryName?.toLowerCase().includes(term) ?? false) ||
      (item.preferredSupplierName?.toLowerCase().includes(term) ?? false);
    const matchesCategory = !categoryFilter || item.categoryName === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sort) {
      case 'status':
        return STATUS_SORT_ORDER[getStockStatus(a)] - STATUS_SORT_ORDER[getStockStatus(b)] || a.name.localeCompare(b.name);
      case 'supplier':
        return (a.preferredSupplierName ?? '').localeCompare(b.preferredSupplierName ?? '') || a.name.localeCompare(b.name);
      case 'category':
      case 'name':
      default:
        return (a.categoryName ?? '').localeCompare(b.categoryName ?? '') || a.name.localeCompare(b.name);
    }
  });

  const storeName = items[0]?.storeName ?? null;

  return (
    <div className="store-inventory-page">
      <div className="store-inventory-page__subtabs">
        <div className="store-inventory-page__subtab-list">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const badgeCount = tab.key === 'items' ? items.length : historyTotal;
            return (
              <button
                key={tab.key}
                type="button"
                className={`store-inventory-page__subtab${subTab === tab.key ? ' store-inventory-page__subtab--active' : ''}`}
                onClick={() => setSubTab(tab.key)}
              >
                <Icon size={14} />
                {tab.label}
                <span className="store-inventory-page__subtab-badge">{badgeCount}</span>
              </button>
            );
          })}
        </div>
        <span className="store-inventory-page__sync-indicator" title="Items and history refresh automatically every 60 seconds">
          <span className="store-inventory-page__sync-dot" aria-hidden="true" />
          Auto-Synced
        </span>
      </div>

      {subTab === 'items' && (
        loadError ? (
          <div className="store-inventory-page__error">
            {loadError}
            <button type="button" className="btn btn--secondary" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="store-inventory-page__title-row">
              <h1 className="store-inventory-page__title">Inventory Master</h1>
              <div className="store-inventory-page__header-actions">
                <div className="store-inventory-page__export" ref={exportMenuRef}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setIsExportMenuOpen((open) => !open)}
                  >
                    <FileText size={14} /> Export
                  </button>
                  {isExportMenuOpen && (
                    <div className="store-inventory-page__export-menu">
                      <button
                        type="button"
                        className="store-inventory-page__export-item"
                        onClick={() => { exportInventoryCatalogCsv(sortedItems); setIsExportMenuOpen(false); }}
                      >
                        <FileSpreadsheet size={14} /> Export as CSV
                      </button>
                      <button
                        type="button"
                        className="store-inventory-page__export-item"
                        onClick={() => { exportInventoryCatalogPdf(sortedItems); setIsExportMenuOpen(false); }}
                      >
                        <FileText size={14} /> Export as PDF
                      </button>
                    </div>
                  )}
                </div>
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
                  onClick={() => { setItemFormError(null); setIsCreateModalOpen(true); }}
                >
                  <span className="store-inventory-page__add-label">
                    <Plus size={16} />
                    Add Item
                  </span>
                </SpecularButton>
              </div>
            </div>

            <div className="stat-card-row">
              <StatCard icon={Boxes} label="Total Items" value={items.length} unit="items" tone="primary" caption={storeName ?? undefined} />
              <StatCard icon={CircleCheck} label="Active Items" value={activeCount} unit="items" tone="success" caption="In Stock & Ready" />
              <StatCard icon={AlertTriangle} label="Low Stock" value={lowStockCount} unit="items" tone="warning" caption="Below Minimum Threshold" />
              <StatCard icon={PackageX} label="Out of Stock" value={outOfStockCount} unit="items" tone="info" caption="Reorder Immediately" />
            </div>

            <div className="filter-bar">
              <div className="filter filter--search">
                <SearchInput value={search} onChange={setSearch} placeholder="Search items by name, category, or supplier" variant="filter" />
              </div>
              <Select
                className="filter"
                options={[
                  { value: '', label: `All Categories (${distinctCategories.length})` },
                  ...distinctCategories.map((name) => ({ value: name, label: name })),
                ]}
                value={categoryFilter}
                onChange={setCategoryFilter}
                ariaLabel="Filter by category"
              />
              <Select
                className="filter"
                options={SORT_OPTIONS}
                value={sort}
                onChange={(value) => setSort(value as SortOption)}
                ariaLabel="Sort items"
              />
              <FilterClearButton
                ariaLabel="Clear inventory filters"
                onClick={() => { setSearch(''); setCategoryFilter(''); setSort('name'); }}
              />
            </div>

            <p className="store-inventory-page__catalog-line">
              <strong>Catalog Directory</strong>
              <span aria-hidden="true"> · </span>
              {isLoading ? 'Loading...' : `Showing ${sortedItems.length} Active Items Across ${distinctCategories.length} Categories`}
            </p>

            <StoreInventoryCardGrid
              items={sortedItems}
              isLoading={isLoading}
              selectedId={editTarget?.id ?? null}
              onEdit={(item) => { setItemFormError(null); setEditTarget(item); }}
              onDelete={(item) => { setDeleteError(null); setDeleteTarget(item); }}
              onToggleStatus={handleToggleStatus}
            />
            {deleteError && <div className="store-inventory-page__error">{deleteError}</div>}

            <StoreInventoryItemFormModal
              isOpen={isCreateModalOpen}
              mode="create"
              categories={categories}
              onCreateCategory={handleCreateCategory}
              suppliers={suppliers}
              onCreateSupplier={handleCreateSupplier}
              errorMessage={itemFormError}
              isSubmitting={isItemSubmitting}
              onClose={() => setIsCreateModalOpen(false)}
              onSubmit={handleCreateSubmit}
            />

            {editTarget && (
              <StoreInventoryItemEditPanel
                isOpen
                item={editTarget}
                categories={categories}
                onCreateCategory={handleCreateCategory}
                suppliers={suppliers}
                onCreateSupplier={handleCreateSupplier}
                errorMessage={itemFormError}
                isSubmitting={isItemSubmitting}
                onClose={() => setEditTarget(null)}
                onSubmit={handleEditSubmit}
              />
            )}

            <ConfirmDialog
              isOpen={deleteTarget !== null}
              title="Delete Inventory Item"
              message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.` : ''}
              onConfirm={handleConfirmDelete}
              onCancel={() => setDeleteTarget(null)}
            />
          </>
        )
      )}

      {subTab === 'history' && <StockCheckHistory onTotalChange={setHistoryTotal} />}
    </div>
  );
}

export default StoreInventory;
