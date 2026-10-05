import { useEffect, useMemo, useState } from 'react';
import { Boxes, CircleCheck, CircleSlash, Plus, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createInventoryItem,
  deleteInventoryItem,
  getAllInventoryItems,
  setInventoryItemActive,
  updateInventoryItem,
} from '../api/inventoryItems';
import { createSupplier, findOrCreateSupplier, getSuppliers, setSupplierActive, updateSupplier } from '../api/suppliers';
import { getAllStores } from '../api/superAdminStores';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { Supplier, SupplierFormValues } from '../types/supplier';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';
import type { StoreOption } from '../components/StoreInventoryItemFormModal';
import StockLevelComparison from '../components/StockLevelComparison';
import StoreInventoryItemFormModal from '../components/StoreInventoryItemFormModal';
import StoreInventoryTable from '../components/StoreInventoryTable';
import SupplierFormModal from '../components/SupplierFormModal';
import SuperAdminSupplierPurchaseReport from '../components/SuperAdminSupplierPurchaseReport';
import Toggle from '../components/Toggle';
import Select from '../components/Select';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './SuperAdminInventory.css';

type SubTab = 'inventory' | 'suppliers' | 'comparison' | 'purchasing-report';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'comparison', label: 'Stock Comparison' },
  { key: 'purchasing-report', label: 'Purchasing Report' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type SupplierModalState = { mode: 'create' } | { mode: 'edit'; supplier: Supplier } | null;
type ItemModalState = { mode: 'create' } | { mode: 'edit'; item: StoreInventoryItem } | null;

const PAGE_SIZE = 10;

function SuperAdminInventory() {
  const [subTab, setSubTab] = useState<SubTab>('inventory');
  const isMobile = useIsMobile();

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
  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [itemDeleteTarget, setItemDeleteTarget] = useState<StoreInventoryItem | null>(null);
  const [itemDeleteError, setItemDeleteError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  // Like the Checklist tab, nothing on the Inventory sub-tab shows until a
  // store is picked -- every stat, filter and row is scoped to that store.
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [itemStatusFilter, setItemStatusFilter] = useState<StatusFilter>('ALL');
  const [itemPage, setItemPage] = useState(1);

  useEffect(() => {
    setItemPage(1);
  }, [itemSearch, selectedStoreId, itemStatusFilter]);

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
      if (itemModal?.mode === 'edit') {
        const updated = await updateInventoryItem(itemModal.item.id, values);
        setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
        nfToast.success(`"${updated.name}" inventory item updated.`);
      } else {
        const created = await createInventoryItem(values);
        setItems((current) => [...current, created]);
        nfToast.success(`"${created.name}" inventory item added.`);
      }
      setItemModal(null);
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

  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    return storeItems.filter((item) => {
      if (term && !item.name.toLowerCase().includes(term)) return false;
      if (itemStatusFilter === 'ACTIVE' && !item.active) return false;
      if (itemStatusFilter === 'INACTIVE' && item.active) return false;
      return true;
    });
  }, [storeItems, itemSearch, itemStatusFilter]);

  const itemPageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const itemCurrentPage = Math.min(itemPage, itemPageCount);
  const visibleItems = isMobile
    ? filteredItems
    : filteredItems.slice((itemCurrentPage - 1) * PAGE_SIZE, itemCurrentPage * PAGE_SIZE);

  const storeOptions = useMemo(() => stores.map((s) => ({ value: String(s.id), label: s.name })), [stores]);

  // Memoised because the form modal resets its fields whenever this reference
  // changes -- an inline object would wipe in-progress input on every re-render
  // (e.g. the 60s poll). Create mode pre-fills the currently selected store.
  const itemInitialValues = useMemo<StoreInventoryItemFormValues | undefined>(() => {
    if (itemModal?.mode === 'edit') {
      return {
        storeId: itemModal.item.storeId,
        name: itemModal.item.name,
        category: itemModal.item.category ?? 'INGREDIENTS',
        unitOfMeasurement: itemModal.item.unitOfMeasurement,
        minWeekday: itemModal.item.minWeekday != null ? String(itemModal.item.minWeekday) : '',
        minWeekend: itemModal.item.minWeekend != null ? String(itemModal.item.minWeekend) : '',
        preferredSupplierId: itemModal.item.preferredSupplierId,
        note: itemModal.item.note ?? '',
        autoPoEnabled: itemModal.item.autoPoEnabled,
      };
    }
    if (itemModal?.mode === 'create') {
      return {
        storeId: selectedStoreId,
        name: '',
        category: 'INGREDIENTS',
        unitOfMeasurement: '',
        minWeekday: '',
        minWeekend: '',
        preferredSupplierId: null,
        note: '',
        autoPoEnabled: true,
      };
    }
    return undefined;
  }, [itemModal, selectedStoreId]);

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
      <div className="super-admin-inventory-page">
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
    <div className="super-admin-inventory-page">
      <div className="super-admin-inventory-page__subtabs">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`super-admin-inventory-page__subtab${subTab === tab.key ? ' super-admin-inventory-page__subtab--active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'inventory' && (
        <>
          <div className="super-admin-inventory-page__store-row">
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
          </div>

          {selectedStoreId === null ? (
            <div className="table-card">
              <div className="table-card__empty super-admin-inventory-page__no-store-msg">
                Select a store above to view its inventory.
              </div>
            </div>
          ) : (
            <>
              <div className="stat-card-row">
                <StatCard icon={Boxes} label="Inventory Items" value={storeItems.length} tone="primary" />
                <StatCard icon={CircleCheck} label="Active" value={activeItemCount} tone="success" />
                <StatCard icon={CircleSlash} label="Inactive" value={storeItems.length - activeItemCount} tone="warning" />
              </div>

              <div className="super-admin-inventory-page__header">
                <p className="super-admin-inventory-page__summary">
                  {`${filteredItems.length} of ${storeItems.length} items`}
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
                  onClick={() => { setItemFormError(null); setItemModal({ mode: 'create' }); }}
                >
                  <span className="super-admin-inventory-page__add-label">
                    <Plus size={16} />
                    Add Inventory Item
                  </span>
                </SpecularButton>
              </div>

              <div className="filter-bar">
                <div className="filter filter--search">
                  <SearchInput value={itemSearch} onChange={setItemSearch} placeholder="Search inventory" variant="filter" />
                </div>
                <Select
                  className="filter filter--narrow"
                  options={STATUS_FILTER_OPTIONS}
                  value={itemStatusFilter}
                  onChange={(value) => setItemStatusFilter(value as StatusFilter)}
                  ariaLabel="Filter by status"
                />
                <FilterClearButton onClick={() => setItemStatusFilter('ALL')} />
              </div>

              <StoreInventoryTable
                items={visibleItems}
                showStore={false}
                isLoading={isLoading}
                onEdit={(item) => {
                  setItemFormError(null);
                  setItemModal({ mode: 'edit', item });
                }}
                onDelete={(item) => {
                  setItemDeleteError(null);
                  setItemDeleteTarget(item);
                }}
                onToggleStatus={handleToggleItem}
                footer={
                  !isMobile && filteredItems.length > 0 ? (
                    <Pagination
                      page={itemCurrentPage}
                      pageCount={itemPageCount}
                      totalItems={filteredItems.length}
                      pageSize={PAGE_SIZE}
                      onPageChange={setItemPage}
                      itemLabel="items"
                    />
                  ) : null
                }
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
        isOpen={itemModal !== null}
        mode={itemModal?.mode ?? 'create'}
        suppliers={suppliers}
        onCreateSupplier={handleCreateSupplier}
        stores={stores}
        showStoreField
        initialValues={itemInitialValues}
        errorMessage={itemFormError}
        isSubmitting={isItemSubmitting}
        onClose={() => setItemModal(null)}
        onSubmit={handleItemSubmit}
      />

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
