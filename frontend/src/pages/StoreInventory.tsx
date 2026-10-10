import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CircleCheck, ClipboardCheck, Clock, FileSpreadsheet, FileText, Package, PackageX, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createStoreInventoryItem,
  deleteStoreInventoryItem,
  getStoreInventoryItems,
  setStoreInventoryItemActive,
  updateStoreInventoryItem,
} from '../api/storeInventory';
import { findOrCreateSupplier, getOwnerSuppliers, hideOwnerSupplier, setOwnerSupplierActive, updateOwnerSupplier } from '../api/suppliers';
import { categoryLabel, type StoreInventoryItem, type StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier, SupplierFormValues } from '../types/supplier';
import StoreInventoryItemFormModal from '../components/StoreInventoryItemFormModal';
import StoreInventoryItemEditPanel from '../components/StoreInventoryItemEditPanel';
import StoreInventoryCardGrid from '../components/StoreInventoryCardGrid';
import ConfirmDialog from '../components/ConfirmDialog';
import StockCheckHistory from '../components/StockCheckHistory';
import SupplierFormModal from '../components/SupplierFormModal';
import Toggle from '../components/Toggle';
import SearchInput from '../components/SearchInput';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import UserAvatar from '../components/UserAvatar';
import Select from '../components/Select';
import FilterClearButton from '../components/FilterClearButton';
import useDismissablePanel from '../hooks/useDismissablePanel';
import { useIsMobile } from '../hooks/useMediaQuery';
import { getStockStatus } from '../utils/storeInventoryStatus';
import { exportInventoryCatalogCsv, exportInventoryCatalogPdf } from '../utils/inventoryCatalogExport';
import { SORT_OPTIONS, STATUS_SORT_ORDER, type SortOption } from '../utils/storeInventorySort';
import './StoreInventory.css';

type SubTab = 'items' | 'suppliers' | 'history';

const SUB_TABS: { key: SubTab; label: string; icon: typeof Package }[] = [
  { key: 'items', label: 'Items', icon: Package },
  { key: 'suppliers', label: 'Suppliers', icon: Truck },
  { key: 'history', label: 'History', icon: Clock },
];

// Mirrors Super Admin Inventory's own Suppliers status-filter options exactly.
const SUPPLIER_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

interface StoreInventoryProps {
  // Set by DashboardShell when a notification (e.g. a Super Admin's stock
  // check correction, RTS-306) is clicked, so this tab opens already on the
  // History sub-tab. `ts` is a nonce, not data -- see the effect below.
  historySeed?: { ts: number };
}

function StoreInventory({ historySeed }: StoreInventoryProps) {
  const isMobile = useIsMobile();
  const [subTab, setSubTab] = useState<SubTab>('items');
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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

  const appliedHistorySeedTs = useRef<number | null>(null);
  useEffect(() => {
    if (!historySeed || historySeed.ts === appliedHistorySeedTs.current) return;
    appliedHistorySeedTs.current = historySeed.ts;
    setSubTab('history');
  }, [historySeed]);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getStoreInventoryItems(), getOwnerSuppliers()])
      .then(([its, sups]) => {
        setItems(its);
        setSuppliers(sups);
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

  // ---- Suppliers tab: rename + activate/deactivate. Adding stays inline in
  // the item form. -----------------------------------------------------------
  const [supplierEditTarget, setSupplierEditTarget] = useState<Supplier | null>(null);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [isSupplierSubmitting, setIsSupplierSubmitting] = useState(false);

  async function handleSupplierSubmit(values: SupplierFormValues) {
    if (!supplierEditTarget) return;
    setSupplierFormError(null);
    setIsSupplierSubmitting(true);
    try {
      const updated = await updateOwnerSupplier(supplierEditTarget.id, values);
      setSuppliers((current) =>
        current.map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      // Items carry the supplier's name, so refresh them after a rename.
      getStoreInventoryItems().then(setItems).catch(() => {});
      nfToast.success(`"${updated.name}" supplier updated.`);
      setSupplierEditTarget(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setSupplierFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSupplierSubmitting(false);
    }
  }

  async function handleToggleSupplier(supplier: Supplier, active: boolean) {
    setSuppliers((current) => current.map((s) => (s.id === supplier.id ? { ...s, active } : s)));
    try {
      const updated = await setOwnerSupplierActive(supplier.id, active);
      setSuppliers((current) => current.map((s) => (s.id === updated.id ? updated : s)));
      nfToast.success(`"${supplier.name}" supplier ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setSuppliers((current) => current.map((s) => (s.id === supplier.id ? supplier : s)));
      nfToast.error(error instanceof Error ? error.message : 'Failed to update supplier status');
    }
  }

  const [supplierHideTarget, setSupplierHideTarget] = useState<Supplier | null>(null);
  const [supplierHideError, setSupplierHideError] = useState<string | null>(null);

  async function handleConfirmSupplierHide() {
    if (!supplierHideTarget) return;
    setSupplierHideError(null);
    const target = supplierHideTarget;
    try {
      await hideOwnerSupplier(target.id);
      setSuppliers((current) => current.filter((s) => s.id !== target.id));
      setSupplierHideTarget(null);
      nfToast.success(`"${target.name}" removed from this store's suppliers.`);
    } catch (error) {
      setSupplierHideTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to remove supplier';
      setSupplierHideError(msg);
      nfToast.error(msg);
    }
  }

  const activeSupplierCount = useMemo(() => suppliers.filter((s) => s.active).length, [suppliers]);

  // Items Count column: single-store scope here, so just a total per
  // supplier (no per-store breakdown needed, unlike Super Admin's own).
  const itemCountBySupplier = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) {
      if (item.preferredSupplierId == null) continue;
      counts.set(item.preferredSupplierId, (counts.get(item.preferredSupplierId) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  // Mirrors Super Admin's own Suppliers filter-bar exactly (RTS-304 parity).
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const visibleSuppliers = useMemo(() => {
    const normalizedSearch = supplierSearch.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (normalizedSearch && !supplier.name.toLowerCase().includes(normalizedSearch)) return false;
      if (supplierStatusFilter === 'ACTIVE' && !supplier.active) return false;
      if (supplierStatusFilter === 'INACTIVE' && supplier.active) return false;
      return true;
    });
  }, [suppliers, supplierSearch, supplierStatusFilter]);

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
    () => [...new Set(items.map((i) => i.category).filter((c): c is NonNullable<typeof c> => !!c))].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b)),
    ),
    [items],
  );


  const filteredItems = items.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.name.toLowerCase().includes(term) ||
      (item.category ? categoryLabel(item.category).toLowerCase().includes(term) : false) ||
      (item.preferredSupplierName?.toLowerCase().includes(term) ?? false);
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
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
        return (a.category ? categoryLabel(a.category) : '').localeCompare(b.category ? categoryLabel(b.category) : '') || a.name.localeCompare(b.name);
    }
  });

  // Shared between its desktop position (next to Export) and its mobile one
  // (below the stat cards) -- rendered in exactly one of the two per isMobile
  // rather than both, since each instance spins up its own WebGL shine effect.
  const addItemButton = (
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
  );

  return (
    <div className="store-inventory-page">
      <div className="store-inventory-page__subtabs">
        <div className="store-inventory-page__subtab-list">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                className={`store-inventory-page__subtab${subTab === tab.key ? ' store-inventory-page__subtab--active' : ''}`}
                onClick={() => setSubTab(tab.key)}
              >
                <Icon size={14} />
                <span className="store-inventory-page__subtab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
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
                {!isMobile && addItemButton}
              </div>
            </div>

            <div className="stat-card-row">
              <StatCard icon={Package} label="Total Items" value={items.length} unit="items" tone="primary" />
              <StatCard icon={CircleCheck} label="Active Items" value={activeCount} unit="items" tone="success" />
              <StatCard icon={AlertTriangle} label="Low Stock" value={lowStockCount} unit="items" tone="warning" />
              <StatCard icon={PackageX} label="Out of Stock" value={outOfStockCount} unit="items" tone="info" />
            </div>

            {isMobile && <div className="store-inventory-page__add-item-mobile">{addItemButton}</div>}

            <div className="filter-bar store-inventory-page__filter-bar">
              <div className="filter filter--search">
                <SearchInput value={search} onChange={setSearch} placeholder="Search items by name, category, or supplier" variant="filter" />
              </div>
              <Select
                className="filter"
                options={[
                  { value: '', label: `All Categories (${distinctCategories.length})` },
                  ...distinctCategories.map((c) => ({ value: c, label: categoryLabel(c) })),
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
              suppliers={suppliers}
              onCreateSupplier={handleCreateSupplier}
              existingCategories={items.map((i) => i.category)}
              errorMessage={itemFormError}
              isSubmitting={isItemSubmitting}
              onClose={() => setIsCreateModalOpen(false)}
              onSubmit={handleCreateSubmit}
            />

            {editTarget && (
              <StoreInventoryItemEditPanel
                isOpen
                item={editTarget}
                suppliers={suppliers}
                onCreateSupplier={handleCreateSupplier}
              existingCategories={items.map((i) => i.category)}
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

      {subTab === 'suppliers' && (
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
              <h1 className="store-inventory-page__title">Suppliers</h1>
            </div>
            <div className="stat-card-row">
              <StatCard icon={Truck} label="Suppliers" value={suppliers.length} tone="primary" />
              <StatCard icon={CircleCheck} label="Active" value={activeSupplierCount} tone="success" />
            </div>
            <p className="store-inventory-page__catalog-line">
              {isLoading ? 'Loading...' : `${activeSupplierCount} active of ${suppliers.length} total. New suppliers are added from the item form.`}
            </p>

            <div className="filter-bar">
              <div className="filter filter--search">
                <SearchInput value={supplierSearch} onChange={setSupplierSearch} placeholder="Search suppliers" variant="filter" />
              </div>
              <Select
                className="filter filter--narrow"
                options={SUPPLIER_STATUS_FILTER_OPTIONS}
                value={supplierStatusFilter}
                onChange={(value) => setSupplierStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                ariaLabel="Filter by status"
              />
              <FilterClearButton onClick={() => { setSupplierSearch(''); setSupplierStatusFilter('ALL'); }} />
            </div>

            <div className="table-card supplier-table-card">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Supplier Name</th>
                      <th scope="col">Items Count</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSuppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td className="supplier-table__cell-name" data-label="Supplier Name">
                          <div className="store-inventory-page__supplier-name-cell">
                            <UserAvatar initials={supplier.name.charAt(0).toUpperCase()} size={28} />
                            <div>
                              <div className="store-inventory-page__supplier-name">{supplier.name}</div>
                              {supplier.location && (
                                <div className="store-inventory-page__supplier-location">{supplier.location}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="supplier-table__cell-count" data-label="Items Count">
                          <span className="supplier-table__count-value">{itemCountBySupplier.get(supplier.id) ?? 0}</span>
                          <span className="supplier-table__items-label">
                            <ClipboardCheck size={14} />
                            {itemCountBySupplier.get(supplier.id) ?? 0} Items
                          </span>
                        </td>
                        {supplier.location && (
                          <td className="supplier-table__cell-location-mobile">{supplier.location}</td>
                        )}
                        <td className="supplier-table__cell-status" data-label="Status">
                          <Toggle
                            checked={supplier.active}
                            onChange={(checked) => handleToggleSupplier(supplier, checked)}
                            label={`${supplier.active ? 'Deactivate' : 'Activate'} ${supplier.name}`}
                          />
                        </td>
                        <td className="table-actions-cell" data-label="Actions">
                          <div className="table-row-actions">
                            <button
                              type="button"
                              className="table-icon-btn"
                              aria-label={`Edit ${supplier.name}`}
                              title="Edit"
                              onClick={() => { setSupplierFormError(null); setSupplierEditTarget(supplier); }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="table-icon-btn table-icon-btn--danger"
                              aria-label={`Remove ${supplier.name} from this store`}
                              title="Remove from this store"
                              onClick={() => { setSupplierHideError(null); setSupplierHideTarget(supplier); }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!isLoading && visibleSuppliers.length === 0 && (
                <div className="table-card__empty">
                  {suppliers.length === 0 ? 'No suppliers yet.' : 'No suppliers match these filters.'}
                </div>
              )}
            </div>

            <SupplierFormModal
              isOpen={supplierEditTarget !== null}
              mode="edit"
              initialValues={supplierEditTarget ? { name: supplierEditTarget.name } : undefined}
              errorMessage={supplierFormError}
              isSubmitting={isSupplierSubmitting}
              onClose={() => setSupplierEditTarget(null)}
              onSubmit={handleSupplierSubmit}
            />

            <ConfirmDialog
              isOpen={supplierHideTarget !== null}
              title="Remove Supplier"
              message={
                supplierHideTarget
                  ? `Remove "${supplierHideTarget.name}" from this store's suppliers and item dropdown? It stays available to every other store and to Super Admin's own supplier directory.`
                  : ''
              }
              onConfirm={handleConfirmSupplierHide}
              onCancel={() => setSupplierHideTarget(null)}
            />
            {supplierHideError && <div className="store-inventory-page__error">{supplierHideError}</div>}
          </>
        )
      )}

      {subTab === 'history' && <StockCheckHistory />}
    </div>
  );
}

export default StoreInventory;
