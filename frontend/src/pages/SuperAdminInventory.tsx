import { useEffect, useMemo, useState } from 'react';
import { Boxes, CircleCheck, CircleSlash, Plus, Tags, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createInventoryCategory,
  getInventoryCategories,
  setInventoryCategoryActive,
  updateInventoryCategory,
} from '../api/inventoryCategories';
import {
  createInventoryItem,
  deleteInventoryItem,
  getAllInventoryItems,
  setInventoryItemActive,
  updateInventoryItem,
} from '../api/inventoryItems';
import { createSupplier, getSuppliers, setSupplierActive, updateSupplier } from '../api/suppliers';
import { getAllStores } from '../api/superAdminStores';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { InventoryCategory, InventoryCategoryFormValues } from '../types/inventory';
import type { Supplier, SupplierFormValues } from '../types/supplier';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';
import type { StoreOption } from '../components/StoreInventoryItemFormModal';
import InventoryCategoryFormModal from '../components/InventoryCategoryFormModal';
import StoreInventoryItemFormModal from '../components/StoreInventoryItemFormModal';
import StoreInventoryTable from '../components/StoreInventoryTable';
import SupplierFormModal from '../components/SupplierFormModal';
import Toggle from '../components/Toggle';
import Select from '../components/Select';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './SuperAdminInventory.css';

type SubTab = 'inventory' | 'categories' | 'suppliers';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'categories', label: 'Categories' },
  { key: 'suppliers', label: 'Suppliers' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type CategoryModalState = { mode: 'create' } | { mode: 'edit'; category: InventoryCategory } | null;
type SupplierModalState = { mode: 'create' } | { mode: 'edit'; supplier: Supplier } | null;
type ItemModalState = { mode: 'create' } | { mode: 'edit'; item: StoreInventoryItem } | null;

const PAGE_SIZE = 10;

function SuperAdminInventory() {
  const [subTab, setSubTab] = useState<SubTab>('inventory');
  const isMobile = useIsMobile();

  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadAll() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getInventoryCategories(), getSuppliers(), getAllStores(), getAllInventoryItems()])
      .then(([cats, sups, sts, its]) => {
        setCategories(cats);
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

  // ---- Inventory items -----------------------------------------------------
  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [itemDeleteTarget, setItemDeleteTarget] = useState<StoreInventoryItem | null>(null);
  const [itemDeleteError, setItemDeleteError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemStoreFilter, setItemStoreFilter] = useState<number | null>(null);
  const [itemStatusFilter, setItemStatusFilter] = useState<StatusFilter>('ALL');
  const [itemPage, setItemPage] = useState(1);

  useEffect(() => {
    setItemPage(1);
  }, [itemSearch, itemStoreFilter, itemStatusFilter]);

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

  const activeItemCount = useMemo(() => items.filter((i) => i.active).length, [items]);

  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (term && !item.name.toLowerCase().includes(term) && !item.categoryName.toLowerCase().includes(term)) return false;
      if (itemStoreFilter != null && item.storeId !== itemStoreFilter) return false;
      if (itemStatusFilter === 'ACTIVE' && !item.active) return false;
      if (itemStatusFilter === 'INACTIVE' && item.active) return false;
      return true;
    });
  }, [items, itemSearch, itemStoreFilter, itemStatusFilter]);

  const itemPageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const itemCurrentPage = Math.min(itemPage, itemPageCount);
  const visibleItems = isMobile
    ? filteredItems
    : filteredItems.slice((itemCurrentPage - 1) * PAGE_SIZE, itemCurrentPage * PAGE_SIZE);

  const storeFilterOptions = [{ value: '', label: 'All Stores' }, ...stores.map((s) => ({ value: String(s.id), label: s.name }))];

  // ---- Categories --------------------------------------------------------
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(null);
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);

  async function handleCategorySubmit(values: InventoryCategoryFormValues) {
    setCategoryFormError(null);
    setIsCategorySubmitting(true);
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
      setCategoryFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsCategorySubmitting(false);
    }
  }

  async function handleToggleCategory(category: InventoryCategory, active: boolean) {
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

  const activeCategoryCount = useMemo(() => categories.filter((c) => c.active).length, [categories]);
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
          <div className="stat-card-row">
            <StatCard icon={Boxes} label="Inventory Items" value={items.length} tone="primary" />
            <StatCard icon={CircleCheck} label="Active" value={activeItemCount} tone="success" />
            <StatCard icon={CircleSlash} label="Inactive" value={items.length - activeItemCount} tone="warning" />
          </div>

          <div className="super-admin-inventory-page__header">
            <p className="super-admin-inventory-page__summary">
              {isLoading ? 'Loading...' : `${filteredItems.length} of ${items.length} items`}
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
              className="filter"
              options={storeFilterOptions}
              value={itemStoreFilter != null ? String(itemStoreFilter) : ''}
              onChange={(value) => setItemStoreFilter(value === '' ? null : Number(value))}
              ariaLabel="Filter by store"
            />
            <Select
              className="filter filter--narrow"
              options={STATUS_FILTER_OPTIONS}
              value={itemStatusFilter}
              onChange={(value) => setItemStatusFilter(value as StatusFilter)}
              ariaLabel="Filter by status"
            />
            {(itemStoreFilter != null || itemStatusFilter !== 'ALL') && (
              <FilterClearButton onClick={() => { setItemStoreFilter(null); setItemStatusFilter('ALL'); }} />
            )}
          </div>

          <StoreInventoryTable
            items={visibleItems}
            showStore
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
              !isMobile && !isLoading && filteredItems.length > 0 ? (
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

      {subTab === 'categories' && (
        <>
          <div className="stat-card-row">
            <StatCard icon={Tags} label="Inventory Categories" value={categories.length} tone="primary" />
            <StatCard icon={CircleCheck} label="Active" value={activeCategoryCount} tone="success" />
          </div>
          <div className="super-admin-inventory-page__header">
            <p className="super-admin-inventory-page__summary">
              {isLoading ? 'Loading...' : `${activeCategoryCount} active of ${categories.length} total`}
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
              onClick={() => { setCategoryFormError(null); setCategoryModal({ mode: 'create' }); }}
            >
              <span className="super-admin-inventory-page__add-label">
                <Plus size={16} />
                Add Category
              </span>
            </SpecularButton>
          </div>
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Category Name</th>
                    <th scope="col">Items</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="super-admin-inventory-page__actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td data-label="Category Name">{category.name}</td>
                      <td data-label="Items">{category.itemCount}</td>
                      <td data-label="Status">
                        <Toggle
                          checked={category.active}
                          onChange={(checked) => handleToggleCategory(category, checked)}
                          label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                        />
                      </td>
                      <td className="table-actions-cell" data-label="Actions">
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="table-icon-btn"
                            aria-label={`Edit ${category.name}`}
                            title="Edit"
                            onClick={() => { setCategoryFormError(null); setCategoryModal({ mode: 'edit', category }); }}
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
            {!isLoading && categories.length === 0 && (
              <div className="super-admin-inventory-page__empty">No inventory categories yet.</div>
            )}
          </div>
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

      <StoreInventoryItemFormModal
        isOpen={itemModal !== null}
        mode={itemModal?.mode ?? 'create'}
        categories={categories}
        suppliers={suppliers}
        stores={stores}
        showStoreField
        initialValues={
          itemModal?.mode === 'edit'
            ? {
                storeId: itemModal.item.storeId,
                name: itemModal.item.name,
                categoryId: itemModal.item.categoryId,
                unitOfMeasurement: itemModal.item.unitOfMeasurement,
                minWeekday: itemModal.item.minWeekday != null ? String(itemModal.item.minWeekday) : '',
                minWeekend: itemModal.item.minWeekend != null ? String(itemModal.item.minWeekend) : '',
                preferredSupplierId: itemModal.item.preferredSupplierId,
                note: itemModal.item.note ?? '',
              }
            : undefined
        }
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

      <InventoryCategoryFormModal
        isOpen={categoryModal !== null}
        mode={categoryModal?.mode ?? 'create'}
        initialValues={categoryModal?.mode === 'edit' ? { name: categoryModal.category.name } : undefined}
        errorMessage={categoryFormError}
        isSubmitting={isCategorySubmitting}
        onClose={() => setCategoryModal(null)}
        onSubmit={handleCategorySubmit}
      />

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
