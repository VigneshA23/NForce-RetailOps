import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Tags, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createInventoryCategory,
  getInventoryCategories,
  setInventoryCategoryActive,
  updateInventoryCategory,
} from '../api/inventoryCategories';
import {
  assignItemToStore,
  createInventoryItem,
  getInventoryItems,
  getStoreAssignments,
  setInventoryItemActive,
  updateInventoryItem,
} from '../api/inventoryItems';
import { createSupplier, getSuppliers, setSupplierActive, updateSupplier } from '../api/suppliers';
import { getAllStores } from '../api/superAdminStores';
import type { InventoryCategory, InventoryCategoryFormValues, InventoryItem, InventoryItemFormValues } from '../types/inventory';
import type { Supplier, SupplierFormValues } from '../types/supplier';
import type { StoreInventoryItem } from '../types/storeInventory';
import type { SuperAdminStore } from '../types/superAdminStore';
import InventoryCategoryFormModal from '../components/InventoryCategoryFormModal';
import InventoryItemFormModal from '../components/InventoryItemFormModal';
import SupplierFormModal from '../components/SupplierFormModal';
import Toggle from '../components/Toggle';
import Select from '../components/Select';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './SuperAdminInventory.css';

type SubTab = 'categories' | 'items' | 'suppliers' | 'assign';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'items', label: 'Items' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'assign', label: 'Assign to Store' },
];

type CategoryModalState = { mode: 'create' } | { mode: 'edit'; category: InventoryCategory } | null;
type ItemModalState = { mode: 'create' } | { mode: 'edit'; item: InventoryItem } | null;
type SupplierModalState = { mode: 'create' } | { mode: 'edit'; supplier: Supplier } | null;

function SuperAdminInventory() {
  const [subTab, setSubTab] = useState<SubTab>('categories');

  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadAll() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getInventoryCategories(), getInventoryItems(), getSuppliers(), getAllStores()])
      .then(([cats, its, sups, sts]) => {
        setCategories(cats);
        setItems(its);
        setSuppliers(sups);
        setStores(sts);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

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

  // ---- Items --------------------------------------------------------------
  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);

  async function handleItemSubmit(values: InventoryItemFormValues) {
    setItemFormError(null);
    setIsItemSubmitting(true);
    try {
      if (itemModal?.mode === 'edit') {
        const updated = await updateInventoryItem(itemModal.item.id, values);
        setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
        nfToast.success(`"${updated.name}" item updated.`);
      } else {
        const created = await createInventoryItem(values);
        setItems((current) => [...current, created]);
        nfToast.success(`"${created.name}" item added.`);
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

  async function handleToggleItem(item: InventoryItem, active: boolean) {
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, active } : i)));
    try {
      const updated = await setInventoryItemActive(item.id, active);
      setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
      nfToast.success(`"${item.name}" item ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setItems((current) => current.map((i) => (i.id === item.id ? item : i)));
      nfToast.error(error instanceof Error ? error.message : 'Failed to update item status');
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

  // ---- Assign to store --------------------------------------------------
  const [assignStoreId, setAssignStoreId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<StoreInventoryItem[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPickItemId, setAssignPickItemId] = useState<number | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (assignStoreId == null) {
      setAssignments([]);
      return;
    }
    setAssignLoading(true);
    getStoreAssignments(assignStoreId)
      .then(setAssignments)
      .catch((error: Error) => nfToast.error(error.message))
      .finally(() => setAssignLoading(false));
  }, [assignStoreId]);

  const unassignedItems = useMemo(() => {
    const assignedIds = new Set(assignments.map((a) => a.inventoryItemId));
    return items.filter((item) => item.active && !assignedIds.has(item.id));
  }, [items, assignments]);

  async function handleAssign() {
    if (assignStoreId == null || assignPickItemId == null) return;
    setIsAssigning(true);
    try {
      const created = await assignItemToStore(assignStoreId, assignPickItemId);
      setAssignments((current) => [...current, created]);
      setAssignPickItemId(null);
      nfToast.success(`"${created.itemName}" assigned to store.`);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to assign item');
    } finally {
      setIsAssigning(false);
    }
  }

  const storeOptions = stores.map((s) => ({ value: String(s.storeId), label: s.storeName }));
  const itemPickOptions = unassignedItems.map((i) => ({ value: String(i.id), label: `${i.name} (${i.categoryName})` }));

  const activeCategoryCount = useMemo(() => categories.filter((c) => c.active).length, [categories]);
  const activeItemCount = useMemo(() => items.filter((i) => i.active).length, [items]);
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
      <div className="stat-card-row">
        <StatCard icon={Tags} label="Inventory Categories" value={activeCategoryCount} tone="primary" />
        <StatCard icon={Package} label="Inventory Items" value={activeItemCount} tone="info" />
        <StatCard icon={Truck} label="Suppliers" value={activeSupplierCount} tone="success" />
      </div>

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

      {subTab === 'categories' && (
        <>
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

      {subTab === 'items' && (
        <>
          <div className="super-admin-inventory-page__header">
            <p className="super-admin-inventory-page__summary">
              {isLoading ? 'Loading...' : `${activeItemCount} active of ${items.length} total`}
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
                Add Item
              </span>
            </SpecularButton>
          </div>
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Item Name</th>
                    <th scope="col">Category</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="super-admin-inventory-page__actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Item Name">{item.name}</td>
                      <td data-label="Category">{item.categoryName}</td>
                      <td data-label="Unit">{item.unitOfMeasurement}</td>
                      <td data-label="Status">
                        <Toggle
                          checked={item.active}
                          onChange={(checked) => handleToggleItem(item, checked)}
                          label={`${item.active ? 'Deactivate' : 'Activate'} ${item.name}`}
                        />
                      </td>
                      <td className="table-actions-cell" data-label="Actions">
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="table-icon-btn"
                            aria-label={`Edit ${item.name}`}
                            title="Edit"
                            onClick={() => {
                              setItemFormError(null);
                              setItemModal({ mode: 'edit', item });
                            }}
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
            {!isLoading && items.length === 0 && (
              <div className="super-admin-inventory-page__empty">No inventory items yet.</div>
            )}
          </div>
        </>
      )}

      {subTab === 'suppliers' && (
        <>
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

      {subTab === 'assign' && (
        <div className="super-admin-inventory-page__assign">
          <div className="filter-bar">
            <Select
              className="filter"
              options={storeOptions}
              value={assignStoreId ? String(assignStoreId) : ''}
              onChange={(value) => setAssignStoreId(Number(value))}
              ariaLabel="Select store"
            />
          </div>

          {assignStoreId == null ? (
            <p className="super-admin-inventory-page__summary">Select a store to view and assign inventory items.</p>
          ) : (
            <>
              <div className="super-admin-inventory-page__assign-row">
                <Select
                  className="filter"
                  options={itemPickOptions}
                  value={assignPickItemId ? String(assignPickItemId) : ''}
                  onChange={(value) => setAssignPickItemId(Number(value))}
                  ariaLabel="Select item to assign"
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={assignPickItemId == null || isAssigning}
                  onClick={handleAssign}
                >
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </button>
              </div>

              <div className="table-card">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Category</th>
                        <th scope="col">Min (Weekday / Weekend)</th>
                        <th scope="col">Preferred Supplier</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td data-label="Item">{assignment.itemName}</td>
                          <td data-label="Category">{assignment.categoryName}</td>
                          <td data-label="Min">
                            {assignment.minWeekday ?? '—'} / {assignment.minWeekend ?? assignment.minWeekday ?? '—'}
                          </td>
                          <td data-label="Preferred Supplier">{assignment.preferredSupplierName ?? '—'}</td>
                          <td data-label="Status">{assignment.active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!assignLoading && assignments.length === 0 && (
                  <div className="super-admin-inventory-page__empty">No items assigned to this store yet.</div>
                )}
                {assignLoading && <div className="super-admin-inventory-page__empty">Loading assignments...</div>}
              </div>
            </>
          )}
        </div>
      )}

      <InventoryCategoryFormModal
        isOpen={categoryModal !== null}
        mode={categoryModal?.mode ?? 'create'}
        initialValues={categoryModal?.mode === 'edit' ? { name: categoryModal.category.name } : undefined}
        errorMessage={categoryFormError}
        isSubmitting={isCategorySubmitting}
        onClose={() => setCategoryModal(null)}
        onSubmit={handleCategorySubmit}
      />

      <InventoryItemFormModal
        isOpen={itemModal !== null}
        mode={itemModal?.mode ?? 'create'}
        categories={categories}
        initialValues={
          itemModal?.mode === 'edit'
            ? { categoryId: itemModal.item.categoryId, name: itemModal.item.name, unitOfMeasurement: itemModal.item.unitOfMeasurement }
            : undefined
        }
        errorMessage={itemFormError}
        isSubmitting={isItemSubmitting}
        onClose={() => setItemModal(null)}
        onSubmit={handleItemSubmit}
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
