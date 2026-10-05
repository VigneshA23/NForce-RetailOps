import { useEffect, useMemo, useState } from 'react';
import { Boxes, CircleCheck, CircleSlash, Plus } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createStoreInventoryItem,
  deleteStoreInventoryItem,
  getStoreInventoryItems,
  setStoreInventoryItemActive,
  updateStoreInventoryItem,
} from '../api/storeInventory';
import { findOrCreateSupplier, getOwnerSuppliers } from '../api/suppliers';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import StoreInventoryItemFormModal from '../components/StoreInventoryItemFormModal';
import StoreInventoryTable from '../components/StoreInventoryTable';
import ConfirmDialog from '../components/ConfirmDialog';
import StockCheckHistory from '../components/StockCheckHistory';
import SearchInput from '../components/SearchInput';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './StoreInventory.css';

type SubTab = 'items' | 'history';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'items', label: 'Items' },
  { key: 'history', label: 'Inventory History' },
];

type ItemModalState = { mode: 'create' } | { mode: 'edit'; item: StoreInventoryItem } | null;

function StoreInventory() {
  const [subTab, setSubTab] = useState<SubTab>('items');
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreInventoryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        const updated = await updateStoreInventoryItem(itemModal.item.id, values);
        setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
        nfToast.success(`"${updated.name}" updated.`);
      } else {
        const created = await createStoreInventoryItem(values);
        setItems((current) => [...current, created]);
        nfToast.success(`"${created.name}" added.`);
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

  const filteredItems = items.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return item.name.toLowerCase().includes(term);
  });

  return (
    <div className="store-inventory-page">
      <div className="store-inventory-page__subtabs">
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
            <div className="stat-card-row">
              <StatCard icon={Boxes} label="Inventory Items" value={items.length} tone="primary" />
              <StatCard icon={CircleCheck} label="Active" value={activeCount} tone="success" />
              <StatCard icon={CircleSlash} label="Inactive" value={items.length - activeCount} tone="warning" />
            </div>

            <div className="store-inventory-page__header">
              <p className="store-inventory-page__summary">
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
                <span className="store-inventory-page__add-label">
                  <Plus size={16} />
                  Add Inventory Item
                </span>
              </SpecularButton>
            </div>

            <div className="filter-bar">
              <div className="filter filter--search">
                <SearchInput value={search} onChange={setSearch} placeholder="Search inventory" variant="filter" />
              </div>
            </div>

            <StoreInventoryTable
              items={filteredItems}
              showStore={false}
              isLoading={isLoading}
              onEdit={(item) => { setItemFormError(null); setItemModal({ mode: 'edit', item }); }}
              onDelete={(item) => { setDeleteError(null); setDeleteTarget(item); }}
              onToggleStatus={handleToggleStatus}
            />
            {deleteError && <div className="store-inventory-page__error">{deleteError}</div>}

            <StoreInventoryItemFormModal
              isOpen={itemModal !== null}
              mode={itemModal?.mode ?? 'create'}
              suppliers={suppliers}
              onCreateSupplier={handleCreateSupplier}
              initialValues={
                itemModal?.mode === 'edit'
                  ? {
                      storeId: null,
                      name: itemModal.item.name,
                      category: itemModal.item.category ?? 'INGREDIENTS',
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
              isOpen={deleteTarget !== null}
              title="Delete Inventory Item"
              message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.` : ''}
              onConfirm={handleConfirmDelete}
              onCancel={() => setDeleteTarget(null)}
            />
          </>
        )
      )}

      {subTab === 'history' && <StockCheckHistory />}
    </div>
  );
}

export default StoreInventory;
