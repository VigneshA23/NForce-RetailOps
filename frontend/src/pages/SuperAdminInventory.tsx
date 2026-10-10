import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, CircleCheck, ClipboardCheck, Clock, FileSpreadsheet, FileText, Package, PackageX, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createInventoryItem,
  deleteInventoryItem,
  getAllInventoryItems,
  getCommonCategories,
  setInventoryItemActive,
  updateInventoryItem,
} from '../api/inventoryItems';
import { createSupplier, deleteSupplier, findOrCreateSupplier, getSuppliers, setSupplierActive, updateSupplier } from '../api/suppliers';
import { getAllStores } from '../api/superAdminStores';
import useDismissablePanel from '../hooks/useDismissablePanel';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Supplier, SupplierFormValues } from '../types/supplier';
import { categoryLabel, type StoreInventoryItem, type StoreInventoryItemFormValues } from '../types/storeInventory';
import type { StoreOption } from '../components/StoreInventoryItemFormModal';
import StockLevelComparison from '../components/StockLevelComparison';
import SuperAdminStockCheckHistory from '../components/SuperAdminStockCheckHistory';
import StoreInventoryItemFormModal from '../components/StoreInventoryItemFormModal';
import StoreInventoryItemEditPanel from '../components/StoreInventoryItemEditPanel';
import StoreInventoryCardGrid from '../components/StoreInventoryCardGrid';
import SupplierFormModal from '../components/SupplierFormModal';
import SuperAdminSupplierPurchaseReport from '../components/SuperAdminSupplierPurchaseReport';
import Toggle from '../components/Toggle';
import Select from '../components/Select';
import SearchableSelect from '../components/SearchableSelect';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import UserAvatar from '../components/UserAvatar';
import { getStockStatus } from '../utils/storeInventoryStatus';
import { exportInventoryCatalogCsv, exportInventoryCatalogPdf } from '../utils/inventoryCatalogExport';
import { SORT_OPTIONS, STATUS_SORT_ORDER, type SortOption } from '../utils/storeInventorySort';
import './StoreInventory.css';
import './SuperAdminInventory.css';

type SubTab = 'inventory' | 'suppliers' | 'comparison' | 'purchasing-report' | 'stock-check-history';

// Icons + live count badges on Inventory/Suppliers/Stock Check History match
// Owner/Admin's own StoreInventory.tsx sub-tab bar (RTS-304); Stock Comparison
// and Purchasing Report have no Owner/Admin equivalent to match, so they stay
// text-only.
const SUB_TABS: { key: SubTab; label: string; icon?: typeof Package }[] = [
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'suppliers', label: 'Suppliers', icon: Truck },
  { key: 'comparison', label: 'Stock Comparison' },
  { key: 'purchasing-report', label: 'Purchasing Report' },
  { key: 'stock-check-history', label: 'Stock Check History', icon: Clock },
];

type SupplierModalState = { mode: 'create' } | { mode: 'edit'; supplier: Supplier } | null;

// Mirrors Super Admin Categories' own status-filter options exactly (RTS-304
// follow-up) -- same values/labels, just filtering suppliers instead.
const SUPPLIER_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

// Mobile "Store Distribution" card dots -- purely decorative, cycles by
// position in the breakdown list.
const SUPPLIER_BREAKDOWN_DOT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed'];

type SupplierStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

function SuperAdminInventory() {
  const isMobile = useIsMobile();
  const [subTab, setSubTab] = useState<SubTab>('inventory');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  // Same shape as SuperAdminOrders.tsx's own store list, so the store-select
  // widget there (SearchableSelect, with search + store code) can be reused
  // here as-is instead of the plain Select this page used to render.
  const [storeSelectOptions, setStoreSelectOptions] = useState<{ id: number; label: string; sublabel: string }[]>([]);
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadAll() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getSuppliers(), getAllStores(), getAllInventoryItems()])
      .then(([sups, sts, its]) => {
        setSuppliers(sups);
        const activeStores = sts.filter((s) => s.storeActive);
        setStores(activeStores.map((s) => ({ id: s.storeId, name: s.storeName })));
        setStoreSelectOptions(activeStores.map((s) => ({ id: s.storeId, label: s.storeName, sublabel: `#${s.storeCode}` })));
        setItems(its);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  // 60-second silent refresh so "Current Available" picks up counts as
  // employees submit today's stock check. A failed poll keeps the last list.
  useEffect(() => {
    const id = window.setInterval(() => {
      getAllInventoryItems().then(setItems).catch(() => {});
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ---- Inventory items -----------------------------------------------------
  // Same shape as Owner/Admin's Inventory page: Add is a centered modal, Edit
  // opens the item in the right-side panel.
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StoreInventoryItem | null>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [itemDeleteTarget, setItemDeleteTarget] = useState<StoreInventoryItem | null>(null);
  const [itemDeleteError, setItemDeleteError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('name');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useDismissablePanel({ isOpen: isExportMenuOpen, onClose: () => setIsExportMenuOpen(false), refs: [exportMenuRef] });
  // Like the Checklist tab, nothing on the Inventory sub-tab shows until a
  // store is picked -- every stat, filter and row is scoped to that store.
  // This selector is the one thing that differs from the Owner/Admin page.
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  // Switching store resets the view and closes anything open for the old one.
  useEffect(() => {
    setItemSearch('');
    setCategoryFilter('');
    setEditTarget(null);
    setIsCreateModalOpen(false);
  }, [selectedStoreId]);

  // Keep the open edit panel's item reference fresh across the 60s poll
  // without resetting what is being typed (the panel keys its reset on id).
  useEffect(() => {
    if (!editTarget) return;
    const fresh = items.find((i) => i.id === editTarget.id);
    if (fresh && fresh !== editTarget) setEditTarget(fresh);
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

  async function handleItemSubmit(values: StoreInventoryItemFormValues) {
    setItemFormError(null);
    setIsItemSubmitting(true);
    try {
      if (editTarget) {
        // The edit panel carries no store; keep the item in its own.
        const updated = await updateInventoryItem(editTarget.id, { ...values, storeId: editTarget.storeId });
        setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
        nfToast.success(`"${updated.name}" updated.`);
        setEditTarget(null);
      } else {
        const { created, skippedStoreNames } = await createInventoryItem(values);
        setItems((current) => [...current, ...created]);
        const name = values.name;
        const skippedNote = skippedStoreNames.length > 0
          ? ` Skipped (already has it): ${skippedStoreNames.join(', ')}.`
          : '';
        if (created.length === 0) {
          nfToast.info(`"${name}" already exists in the selected stores.`);
        } else {
          nfToast.success(
            `"${name}" added${created.length > 1 ? ` to ${created.length} stores` : ''}.${skippedNote}`,
          );
        }
        setIsCreateModalOpen(false);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setItemFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsItemSubmitting(false);
    }
  }

  async function handleToggleItem(item: StoreInventoryItem, active: boolean) {
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, active } : i)));
    try {
      const updated = await setInventoryItemActive(item.id, active);
      setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
      nfToast.success(`"${item.name}" ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setItems((current) => current.map((i) => (i.id === item.id ? item : i)));
      nfToast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  }

  async function handleConfirmItemDelete() {
    if (!itemDeleteTarget) return;
    setItemDeleteError(null);
    try {
      await deleteInventoryItem(itemDeleteTarget.id);
      setItems((current) => current.filter((i) => i.id !== itemDeleteTarget.id));
      const deletedName = itemDeleteTarget.name;
      setItemDeleteTarget(null);
      nfToast.success(`"${deletedName}" deleted.`);
    } catch (error) {
      setItemDeleteTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to delete inventory item';
      setItemDeleteError(msg);
      nfToast.error(msg);
    }
  }

  const storeItems = useMemo(
    () => (selectedStoreId == null ? [] : items.filter((i) => i.storeId === selectedStoreId)),
    [items, selectedStoreId],
  );
  const activeItemCount = useMemo(() => storeItems.filter((i) => i.active).length, [storeItems]);
  const lowStockCount = useMemo(() => storeItems.filter((i) => getStockStatus(i) === 'low').length, [storeItems]);
  const outOfStockCount = useMemo(() => storeItems.filter((i) => getStockStatus(i) === 'out').length, [storeItems]);

  const distinctCategories = useMemo(
    () => [...new Set(storeItems.map((i) => i.category).filter((c): c is NonNullable<typeof c> => !!c))].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b)),
    ),
    [storeItems],
  );

  const sortedItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    const filtered = storeItems.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.category ? categoryLabel(item.category).toLowerCase().includes(term) : false) ||
        (item.preferredSupplierName?.toLowerCase().includes(term) ?? false);
      return matchesSearch && (!categoryFilter || item.category === categoryFilter);
    });
    return filtered.sort((a, b) => {
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
  }, [storeItems, itemSearch, categoryFilter, sort]);

  // Memoised because the form modal resets its fields whenever this reference
  // changes -- an inline object would wipe in-progress input on every re-render
  // (e.g. the 60s poll).
  const createInitialValues = useMemo<StoreInventoryItemFormValues>(
    () => ({
      storeId: selectedStoreId,
      storeIds: selectedStoreId == null ? [] : [selectedStoreId],
      name: '',
      category: '',
      unitOfMeasurement: '',
      minWeekday: '',
      minWeekend: '',
      preferredSupplierId: null,
      note: '',
      autoPoEnabled: true,
      imageId: null,
      imagePhotoId: null,
      imagePreviewUrl: null,
      removeImage: false,
    }),
    [selectedStoreId],
  );

  // ---- Suppliers ------------------------------------------------------------
  const [supplierModal, setSupplierModal] = useState<SupplierModalState>(null);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [isSupplierSubmitting, setIsSupplierSubmitting] = useState(false);

  async function handleSupplierSubmit(values: SupplierFormValues) {
    setSupplierFormError(null);
    setIsSupplierSubmitting(true);
    try {
      if (supplierModal?.mode === 'edit') {
        const updated = await updateSupplier(supplierModal.supplier.id, values);
        setSuppliers((current) => current.map((s) => (s.id === updated.id ? updated : s)));
        nfToast.success(`"${updated.name}" supplier updated.`);
      } else {
        const created = await createSupplier(values);
        setSuppliers((current) => [...current, created]);
        nfToast.success(`"${created.name}" supplier added.`);
      }
      setSupplierModal(null);
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
      const updated = await setSupplierActive(supplier.id, active);
      setSuppliers((current) => current.map((s) => (s.id === updated.id ? updated : s)));
      nfToast.success(`"${supplier.name}" supplier ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setSuppliers((current) => current.map((s) => (s.id === supplier.id ? supplier : s)));
      nfToast.error(error instanceof Error ? error.message : 'Failed to update supplier status');
    }
  }

  const [supplierDeleteTarget, setSupplierDeleteTarget] = useState<Supplier | null>(null);
  const [supplierDeleteError, setSupplierDeleteError] = useState<string | null>(null);

  async function handleConfirmSupplierDelete() {
    if (!supplierDeleteTarget) return;
    setSupplierDeleteError(null);
    const target = supplierDeleteTarget;
    try {
      const result = await deleteSupplier(target.id);
      if (result.deleted) {
        setSuppliers((current) => current.filter((s) => s.id !== target.id));
        nfToast.success(`"${target.name}" supplier deleted.`);
      } else {
        setSuppliers((current) => current.map((s) => (s.id === target.id ? { ...s, active: false } : s)));
        nfToast.success(`"${target.name}" has order history, so it was deactivated instead of deleted.`);
      }
      setSupplierDeleteTarget(null);
    } catch (error) {
      setSupplierDeleteTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to delete supplier';
      setSupplierDeleteError(msg);
      nfToast.error(msg);
    }
  }

  const activeSupplierCount = useMemo(() => suppliers.filter((s) => s.active).length, [suppliers]);

  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<SupplierStatusFilter>('ALL');

  const visibleSuppliers = useMemo(() => {
    const normalizedSearch = supplierSearch.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (normalizedSearch && !supplier.name.toLowerCase().includes(normalizedSearch)) return false;
      if (supplierStatusFilter === 'ACTIVE' && !supplier.active) return false;
      if (supplierStatusFilter === 'INACTIVE' && supplier.active) return false;
      return true;
    });
  }, [suppliers, supplierSearch, supplierStatusFilter]);

  // Items Count column: total items per supplier, plus a per-store breakdown
  // for the expand row -- computed client-side from the already-loaded items
  // list, no extra fetch needed.
  const itemsBySupplier = useMemo(() => {
    const bySupplier = new Map<number, Map<number, { storeName: string; count: number }>>();
    for (const item of items) {
      if (item.preferredSupplierId == null) continue;
      let byStore = bySupplier.get(item.preferredSupplierId);
      if (!byStore) {
        byStore = new Map();
        bySupplier.set(item.preferredSupplierId, byStore);
      }
      const existing = byStore.get(item.storeId);
      if (existing) {
        existing.count += 1;
      } else {
        byStore.set(item.storeId, { storeName: item.storeName, count: 1 });
      }
    }
    return bySupplier;
  }, [items]);

  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Set<number>>(new Set());

  function toggleSupplierExpanded(supplierId: number) {
    setExpandedSupplierIds((current) => {
      const next = new Set(current);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }

  // "View Items" on a supplier's per-store breakdown row -- jumps to the
  // Inventory sub-tab with that store selected and the search box prefilled
  // with the supplier's name (itemSearch already matches preferredSupplierName,
  // so this reuses the existing item list/search instead of a new view).
  function handleViewStoreItems(storeId: number, supplierName: string) {
    setSelectedStoreId(storeId);
    setItemSearch(supplierName);
    setSubTab('inventory');
  }

  // Shared between its desktop position (next to Export) and its mobile one
  // (below the stat cards) -- rendered in exactly one of the two per
  // isMobile, same pattern as StoreInventory.tsx's own addItemButton.
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

  if (loadError) {
    return (
      <div className="store-inventory-page super-admin-inventory-page">
        <div className="owners-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={loadAll}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="store-inventory-page super-admin-inventory-page">
      <div className="store-inventory-page__subtabs">
        <div className="store-inventory-page__subtab-list store-inventory-page__subtab-list--scroll">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              className={`store-inventory-page__subtab${subTab === tab.key ? ' store-inventory-page__subtab--active' : ''}`}
              onClick={() => setSubTab(tab.key)}
            >
              {Icon && <Icon size={14} />}
              <span className="store-inventory-page__subtab-label">{tab.label}</span>
            </button>
          );
        })}
        </div>
        {subTab === 'inventory' && (
          <div className="super-admin-inventory-page__store-select">
            <SearchableSelect
              id="sa-inventory-store-select"
              options={storeSelectOptions}
              selectedIds={selectedStoreId === null ? [] : [selectedStoreId]}
              onChange={(ids) => setSelectedStoreId(ids[0] ?? null)}
              placeholder="Select a store…"
              isLoading={isLoading}
              emptyMessage="No stores found"
            />
          </div>
        )}
      </div>

      {subTab === 'inventory' && (
        <>
          {selectedStoreId === null ? (
            <div className="table-card">
              <div className="table-card__empty super-admin-inventory-page__no-store-msg">
                Select a store above to view its inventory.
              </div>
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
                <StatCard icon={Package} label="Total Items" value={storeItems.length} unit="items" tone="primary" />
                <StatCard icon={CircleCheck} label="Active Items" value={activeItemCount} unit="items" tone="success" />
                <StatCard icon={AlertTriangle} label="Low Stock" value={lowStockCount} unit="items" tone="warning" />
                <StatCard icon={PackageX} label="Out of Stock" value={outOfStockCount} unit="items" tone="info" />
              </div>

              {isMobile && <div className="store-inventory-page__add-item-mobile">{addItemButton}</div>}

              <div className="filter-bar store-inventory-page__filter-bar">
                <div className="filter filter--search">
                  <SearchInput value={itemSearch} onChange={setItemSearch} placeholder="Search items by name, category, or supplier" variant="filter" />
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
                  onClick={() => { setItemSearch(''); setCategoryFilter(''); setSort('name'); }}
                />
              </div>

              <p className="store-inventory-page__catalog-line">
                <strong>Catalog Directory</strong>
                <span aria-hidden="true"> · </span>
                {isLoading ? 'Loading...' : `Showing ${sortedItems.length} Items Across ${distinctCategories.length} Categories`}
              </p>

              <StoreInventoryCardGrid
                items={sortedItems}
                isLoading={isLoading}
                selectedId={editTarget?.id ?? null}
                onEdit={(item) => { setItemFormError(null); setEditTarget(item); }}
                onDelete={(item) => { setItemDeleteError(null); setItemDeleteTarget(item); }}
                onToggleStatus={handleToggleItem}
              />
            </>
          )}
        </>
      )}

      {subTab === 'suppliers' && (
        <>
          <div className="stat-card-row">
            <StatCard icon={Truck} label="Suppliers" value={suppliers.length} tone="primary" />
            <StatCard icon={CircleCheck} label="Active" value={activeSupplierCount} tone="success" />
          </div>
          <div className="super-admin-inventory-page__header">
            <p className="super-admin-inventory-page__summary">
              {isLoading ? 'Loading...' : `${activeSupplierCount} active of ${suppliers.length} total`}
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
              onClick={() => { setSupplierFormError(null); setSupplierModal({ mode: 'create' }); }}
            >
              <span className="super-admin-inventory-page__add-label">
                <Plus size={16} />
                Add Supplier
              </span>
            </SpecularButton>
          </div>

          <div className="filter-bar">
            <div className="filter filter--search">
              <SearchInput value={supplierSearch} onChange={setSupplierSearch} placeholder="Search suppliers" variant="filter" />
            </div>
            <Select
              className="filter filter--narrow"
              options={SUPPLIER_STATUS_FILTER_OPTIONS}
              value={supplierStatusFilter}
              onChange={(value) => setSupplierStatusFilter(value as SupplierStatusFilter)}
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
                    <th scope="col">Assigned Store</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="super-admin-inventory-page__actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSuppliers.map((supplier) => {
                    const byStore = itemsBySupplier.get(supplier.id);
                    const storeBreakdown = byStore
                      ? [...byStore.entries()]
                          .map(([storeId, s]) => ({ storeId, storeName: s.storeName, count: s.count }))
                          .sort((a, b) => a.storeName.localeCompare(b.storeName))
                      : [];
                    const totalItems = storeBreakdown.reduce((sum, s) => sum + s.count, 0);
                    const isExpanded = expandedSupplierIds.has(supplier.id);
                    return (
                      <Fragment key={supplier.id}>
                        <tr
                          className="super-admin-inventory-page__supplier-row"
                          aria-expanded={isExpanded}
                          onClick={() => toggleSupplierExpanded(supplier.id)}
                        >
                          <td className="supplier-table__cell-name" data-label="Supplier Name">
                            <div className="super-admin-inventory-page__supplier-name-cell">
                              <ChevronDown
                                size={16}
                                className={`super-admin-inventory-page__supplier-chevron${isExpanded ? '' : ' super-admin-inventory-page__supplier-chevron--collapsed'}`}
                              />
                              <UserAvatar initials={supplier.name.charAt(0).toUpperCase()} size={28} />
                              <div>
                                <div className="super-admin-inventory-page__supplier-name">{supplier.name}</div>
                                {supplier.location && (
                                  <div className="super-admin-inventory-page__supplier-location">{supplier.location}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td data-label="Items Count" className="super-admin-inventory-page__count-cell supplier-table__cell-count">
                            <span className="supplier-table__count-value">{totalItems}</span>
                            <span className="supplier-table__items-label">
                              <ClipboardCheck size={14} />
                              {totalItems} Items
                            </span>
                            <button
                              type="button"
                              className="supplier-table__details-toggle"
                              onClick={(event) => { event.stopPropagation(); toggleSupplierExpanded(supplier.id); }}
                            >
                              {isExpanded ? 'Hide Details' : 'Show Details'}
                              <ChevronDown
                                size={14}
                                className={isExpanded ? 'supplier-table__details-chevron--up' : undefined}
                              />
                            </button>
                          </td>
                          <td className="supplier-table__cell-store" data-label="Assigned Store">
                            {supplier.appliesToAllStores ? (
                              <span className="employee-table__store-badge">All Stores</span>
                            ) : (supplier.stores ?? []).length === 0 ? (
                              <span className="employee-table__no-stores">—</span>
                            ) : (
                              <div className="employee-table__store-badges">
                                {(supplier.stores ?? []).map((store) => (
                                  <span key={store.id} className="employee-table__store-badge">{store.name}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="supplier-table__cell-status" data-label="Status" onClick={(event) => event.stopPropagation()}>
                            <Toggle
                              checked={supplier.active}
                              onChange={(checked) => handleToggleSupplier(supplier, checked)}
                              label={`${supplier.active ? 'Deactivate' : 'Activate'} ${supplier.name}`}
                            />
                          </td>
                          <td className="table-actions-cell" data-label="Actions" onClick={(event) => event.stopPropagation()}>
                            <div className="table-row-actions">
                              <button
                                type="button"
                                className="table-icon-btn"
                                aria-label={`Edit ${supplier.name}`}
                                title="Edit"
                                onClick={() => { setSupplierFormError(null); setSupplierModal({ mode: 'edit', supplier }); }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="table-icon-btn table-icon-btn--danger"
                                aria-label={`Delete ${supplier.name}`}
                                title="Delete"
                                onClick={() => { setSupplierDeleteError(null); setSupplierDeleteTarget(supplier); }}
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
                            <>
                              {/* Desktop: real table columns, for exact alignment under the
                                  Items Count header -- see supplier-table-card CSS for the
                                  mobile-only card version below. */}
                              <tr className="supplier-table__breakdown-heading-row supplier-table__desktop-only">
                                <td colSpan={5}>Store Distribution</td>
                              </tr>
                              {storeBreakdown.map((s, i) => (
                                <tr key={s.storeId} className="super-admin-inventory-page__breakdown-row supplier-table__desktop-only">
                                  <td data-label="Store">
                                    <div className="super-admin-inventory-page__breakdown-store">
                                      <span
                                        className="supplier-table__breakdown-dot"
                                        style={{ background: SUPPLIER_BREAKDOWN_DOT_COLORS[i % SUPPLIER_BREAKDOWN_DOT_COLORS.length] }}
                                      />
                                      <Package size={14} />
                                      {s.storeName}
                                    </div>
                                  </td>
                                  <td data-label="Items Count" className="super-admin-inventory-page__count-cell">{s.count}</td>
                                  <td />
                                  <td />
                                  <td className="table-actions-cell">
                                    <button
                                      type="button"
                                      className="super-admin-inventory-page__view-items"
                                      onClick={() => handleViewStoreItems(s.storeId, supplier.name)}
                                    >
                                      View Items
                                      <ChevronRight size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {/* Mobile: one wrapping cell holding a "Store Distribution"
                                  card panel instead of extra table columns. */}
                              <tr className="supplier-table__mobile-only">
                                <td colSpan={5}>
                                  <div className="supplier-table__breakdown-panel">
                                    <div className="supplier-table__breakdown-heading">Store Distribution</div>
                                    {storeBreakdown.map((s, i) => (
                                      <div key={s.storeId} className="supplier-table__breakdown-card">
                                        <span
                                          className="supplier-table__breakdown-dot"
                                          style={{ background: SUPPLIER_BREAKDOWN_DOT_COLORS[i % SUPPLIER_BREAKDOWN_DOT_COLORS.length] }}
                                        />
                                        <span className="supplier-table__breakdown-card-name">{s.storeName}</span>
                                        <button
                                          type="button"
                                          className="super-admin-inventory-page__view-items"
                                          onClick={() => handleViewStoreItems(s.storeId, supplier.name)}
                                        >
                                          View Items
                                          <ChevronRight size={14} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            </>
                          )
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!isLoading && visibleSuppliers.length === 0 && (
              <div className="super-admin-inventory-page__empty">
                {suppliers.length === 0 ? 'No suppliers yet.' : 'No suppliers match these filters.'}
              </div>
            )}
          </div>
        </>
      )}

      {subTab === 'comparison' && <StockLevelComparison items={items} />}
      {subTab === 'purchasing-report' && <SuperAdminSupplierPurchaseReport />}
      {subTab === 'stock-check-history' && <SuperAdminStockCheckHistory />}

      <StoreInventoryItemFormModal
        isOpen={isCreateModalOpen}
        mode="create"
        suppliers={suppliers}
        onCreateSupplier={handleCreateSupplier}
        stores={stores}
        showStoreField
        loadCategories={getCommonCategories}
        initialValues={createInitialValues}
        errorMessage={itemFormError}
        isSubmitting={isItemSubmitting}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleItemSubmit}
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
          onSubmit={handleItemSubmit}
        />
      )}

      <ConfirmDialog
        isOpen={itemDeleteTarget !== null}
        title="Delete Inventory Item"
        message={
          itemDeleteTarget
            ? `Are you sure you want to delete "${itemDeleteTarget.name}"? This cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmItemDelete}
        onCancel={() => setItemDeleteTarget(null)}
      />
      {itemDeleteError && <div className="owners-page__error">{itemDeleteError}</div>}

      <ConfirmDialog
        isOpen={supplierDeleteTarget !== null}
        title="Delete Supplier"
        message={
          supplierDeleteTarget
            ? `Are you sure you want to delete "${supplierDeleteTarget.name}"? If it has order history, it will be deactivated instead. This cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmSupplierDelete}
        onCancel={() => setSupplierDeleteTarget(null)}
      />
      {supplierDeleteError && <div className="owners-page__error">{supplierDeleteError}</div>}

      <SupplierFormModal
        isOpen={supplierModal !== null}
        mode={supplierModal?.mode ?? 'create'}
        extended
        availableStores={stores}
        initialValues={
          supplierModal?.mode === 'edit'
            ? {
                name: supplierModal.supplier.name,
                contact: supplierModal.supplier.contact ?? '',
                location: supplierModal.supplier.location ?? '',
                appliesToAllStores: supplierModal.supplier.appliesToAllStores ?? false,
                storeIds: (supplierModal.supplier.stores ?? []).map((s) => s.id),
              }
            : undefined
        }
        errorMessage={supplierFormError}
        isSubmitting={isSupplierSubmitting}
        onClose={() => setSupplierModal(null)}
        onSubmit={handleSupplierSubmit}
      />
    </div>
  );
}

export default SuperAdminInventory;
