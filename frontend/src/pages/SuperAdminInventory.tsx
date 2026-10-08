import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Boxes, CircleCheck, FileSpreadsheet, FileText, PackageX, Plus, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createInventoryItem,
  deleteInventoryItem,
  getAllInventoryItems,
  getCommonCategories,
  setInventoryItemActive,
  updateInventoryItem,
} from '../api/inventoryItems';
import { createSupplier, findOrCreateSupplier, getSuppliers, setSupplierActive, updateSupplier } from '../api/suppliers';
import { getAllStores } from '../api/superAdminStores';
import useDismissablePanel from '../hooks/useDismissablePanel';
import type { Supplier, SupplierFormValues } from '../types/supplier';
import { categoryLabel, type StoreInventoryItem, type StoreInventoryItemFormValues } from '../types/storeInventory';
import type { StoreOption } from '../components/StoreInventoryItemFormModal';
import StockLevelComparison from '../components/StockLevelComparison';
import StoreInventoryItemFormModal from '../components/StoreInventoryItemFormModal';
import StoreInventoryItemEditPanel from '../components/StoreInventoryItemEditPanel';
import StoreInventoryCardGrid from '../components/StoreInventoryCardGrid';
import SupplierFormModal from '../components/SupplierFormModal';
import SuperAdminSupplierPurchaseReport from '../components/SuperAdminSupplierPurchaseReport';
import Toggle from '../components/Toggle';
import Select from '../components/Select';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import { getStockStatus } from '../utils/storeInventoryStatus';
import { exportInventoryCatalogCsv, exportInventoryCatalogPdf } from '../utils/inventoryCatalogExport';
import './StoreInventory.css';
import './SuperAdminInventory.css';

type SubTab = 'inventory' | 'suppliers' | 'comparison' | 'purchasing-report';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'comparison', label: 'Stock Comparison' },
  { key: 'purchasing-report', label: 'Purchasing Report' },
];

type SortOption = 'name' | 'status' | 'supplier' | 'category';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Sort: Category & Name' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'supplier', label: 'Sort: Supplier' },
  { value: 'category', label: 'Sort: Category' },
];


const STATUS_SORT_ORDER = { low: 0, out: 1, in: 2, inactive: 3 } as const;

type SupplierModalState = { mode: 'create' } | { mode: 'edit'; supplier: Supplier } | null;

function SuperAdminInventory() {
  const [subTab, setSubTab] = useState<SubTab>('inventory');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadAll() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getSuppliers(), getAllStores(), getAllInventoryItems()])
      .then(([sups, sts, its]) => {
        setSuppliers(sups);
        setStores(sts.filter((s) => s.storeActive).map((s) => ({ id: s.storeId, name: s.storeName })));
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

  const storeOptions = useMemo(() => stores.map((s) => ({ value: String(s.id), label: s.name })), [stores]);
  const selectedStoreName = stores.find((s) => s.id === selectedStoreId)?.name;

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

  const activeSupplierCount = useMemo(() => suppliers.filter((s) => s.active).length, [suppliers]);

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
        <div className="store-inventory-page__subtab-list">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`store-inventory-page__subtab${subTab === tab.key ? ' store-inventory-page__subtab--active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        </div>
        {subTab === 'inventory' && (
          <Select
            id="sa-inventory-store-select"
            className={`super-admin-inventory-page__store-select${selectedStoreId === null ? ' super-admin-inventory-page__store-select--unselected' : ''}`}
            options={storeOptions}
            value={selectedStoreId !== null ? String(selectedStoreId) : ''}
            onChange={(value) => setSelectedStoreId(value ? Number(value) : null)}
            placeholder={isLoading ? 'Loading stores…' : 'Select a store…'}
            ariaLabel="Select a store"
            disabled={isLoading}
          />
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
                <StatCard icon={Boxes} label="Total Items" value={storeItems.length} unit="items" tone="primary" caption={selectedStoreName} />
                <StatCard icon={CircleCheck} label="Active Items" value={activeItemCount} unit="items" tone="success" caption="In Stock & Ready" />
                <StatCard icon={AlertTriangle} label="Low Stock" value={lowStockCount} unit="items" tone="warning" caption="Below Minimum Threshold" />
                <StatCard icon={PackageX} label="Out of Stock" value={outOfStockCount} unit="items" tone="info" caption="Reorder Immediately" />
              </div>

              <div className="filter-bar">
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
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Supplier Name</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="super-admin-inventory-page__actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td data-label="Supplier Name">{supplier.name}</td>
                      <td data-label="Status">
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
                            onClick={() => { setSupplierFormError(null); setSupplierModal({ mode: 'edit', supplier }); }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoading && suppliers.length === 0 && (
              <div className="super-admin-inventory-page__empty">No suppliers yet.</div>
            )}
          </div>
        </>
      )}

      {subTab === 'comparison' && <StockLevelComparison items={items} />}
      {subTab === 'purchasing-report' && <SuperAdminSupplierPurchaseReport />}

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

      <SupplierFormModal
        isOpen={supplierModal !== null}
        mode={supplierModal?.mode ?? 'create'}
        initialValues={supplierModal?.mode === 'edit' ? { name: supplierModal.supplier.name } : undefined}
        errorMessage={supplierFormError}
        isSubmitting={isSupplierSubmitting}
        onClose={() => setSupplierModal(null)}
        onSubmit={handleSupplierSubmit}
      />
    </div>
  );
}

export default SuperAdminInventory;
