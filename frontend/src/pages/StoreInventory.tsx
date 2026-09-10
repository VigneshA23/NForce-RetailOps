import { useEffect, useState } from 'react';
import { Boxes, CircleCheck, CircleSlash } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getStoreInventoryItems, updateStoreInventoryItemConfig } from '../api/storeInventory';
import { getOwnerSuppliers } from '../api/suppliers';
import type { StoreInventoryItem, StoreInventoryItemConfigFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import StoreInventoryItemConfigModal from '../components/StoreInventoryItemConfigModal';
import SearchInput from '../components/SearchInput';
import StatCard from '../components/StatCard';
import './StoreInventory.css';

function StoreInventory() {
  const [items, setItems] = useState<StoreInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [configTarget, setConfigTarget] = useState<StoreInventoryItem | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConfigSubmitting, setIsConfigSubmitting] = useState(false);

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

  async function handleConfigSubmit(values: StoreInventoryItemConfigFormValues) {
    if (!configTarget) return;
    setConfigError(null);
    setIsConfigSubmitting(true);
    try {
      const updated = await updateStoreInventoryItemConfig(configTarget.id, values);
      setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));
      nfToast.success(`"${updated.itemName}" configuration saved.`);
      setConfigTarget(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save configuration';
      setConfigError(msg);
      nfToast.error(msg);
    } finally {
      setIsConfigSubmitting(false);
    }
  }

  const configuredCount = items.filter((i) => i.minWeekday != null).length;

  const filteredItems = items.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return item.itemName.toLowerCase().includes(term) || item.categoryName.toLowerCase().includes(term);
  });

  if (loadError) {
    return (
      <div className="store-inventory-page">
        <div className="store-inventory-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="store-inventory-page">
      <div className="stat-card-row">
        <StatCard icon={Boxes} label="Assigned Items" value={items.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Configured" value={configuredCount} tone="success" />
        <StatCard icon={CircleSlash} label="Not Yet Configured" value={items.length - configuredCount} tone="warning" />
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search items" variant="filter" />
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Category</th>
                <th scope="col">Unit</th>
                <th scope="col">Min (Weekday / Weekend)</th>
                <th scope="col">Preferred Supplier</th>
                <th scope="col" className="store-inventory-page__actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td data-label="Item">{item.itemName}</td>
                  <td data-label="Category">{item.categoryName}</td>
                  <td data-label="Unit">{item.unitOfMeasurement}</td>
                  <td data-label="Min">
                    {item.minWeekday ?? '—'} / {item.minWeekend ?? item.minWeekday ?? '—'}
                  </td>
                  <td data-label="Preferred Supplier">{item.preferredSupplierName ?? '—'}</td>
                  <td className="table-actions-cell" data-label="Actions">
                    <div className="table-row-actions">
                      <button
                        type="button"
                        className="table-icon-btn"
                        aria-label={`Configure ${item.itemName}`}
                        title="Configure"
                        onClick={() => { setConfigError(null); setConfigTarget(item); }}
                      >
                        Configure
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredItems.length === 0 && (
          <div className="store-inventory-page__empty">
            {items.length === 0
              ? 'No inventory items assigned to your store yet. Ask your Super Admin to assign items from the master catalog.'
              : 'No items match your search.'}
          </div>
        )}
        {isLoading && <div className="store-inventory-page__empty">Loading...</div>}
      </div>

      <StoreInventoryItemConfigModal
        isOpen={configTarget !== null}
        item={configTarget}
        suppliers={suppliers}
        errorMessage={configError}
        isSubmitting={isConfigSubmitting}
        onClose={() => setConfigTarget(null)}
        onSubmit={handleConfigSubmit}
      />
    </div>
  );
}

export default StoreInventory;
