import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, PackageCheck, PackageSearch, Truck } from 'lucide-react';
import { getAllStores } from '../api/superAdminStores';
import { getOrderListForStore, getOutstandingOrders, updateSuperAdminOrderStatus } from '../api/superAdminOperations';
import type { OutstandingOrdersOverview } from '../api/superAdminOperations';
import type { OrderListEntry, OrderStatus } from '../types/orderList';
import { STATUS_META, STATUS_ORDER } from '../utils/orderListStatus';
import SearchableSelect from '../components/SearchableSelect';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import StatCard from '../components/StatCard';
import StatusDotMenu from '../components/StatusDotMenu';
import { nfToast } from '../utils/toast';
import './SuperAdminOrders.css';

type StatusFilter = 'OPEN' | OrderStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'All open' },
  { value: 'NEEDS_ORDERING', label: 'Needs ordering' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
];

const STATUS_OPTIONS = STATUS_ORDER.map((key) => ({ value: key, label: STATUS_META[key].label, dot: STATUS_META[key].fg }));

// Same short absolute-date formatting as SuperAdminHome's own Outstanding
// Orders card -- these entries can be weeks old, so a relative string would
// be less useful than an absolute one.
function formatOldest(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface OrderStoreFocus {
  storeId: number;
  storeName: string;
  // Nonce, not data -- see the effect below. Same house pattern as
  // employeeFocus/issueFocus in SuperAdminDashboard.
  ts: number;
}

interface SuperAdminOrdersProps {
  // Set by the Home tab's Outstanding Orders card when a store row is
  // clicked, so this tab opens already on that store.
  focusStore?: OrderStoreFocus | null;
}

// Super Admin's cross-store Orders page (RTS-307). Unlike Owner/Admin's own
// OrderList.tsx, this is deliberately NOT a full ordering workbench --
// grouping by supplier, bulk actions, "Add to order" and export are all
// Owner/Admin's day-to-day ordering job, not Super Admin's oversight one.
// This page covers exactly RTS-307's acceptance criteria: a cross-store
// outstanding summary, a full per-store list (any store, not just ones with
// something outstanding, so a fully-caught-up store's history is still
// reachable), a status filter that doubles as the Received/history view, and
// status changes that reuse Owner/Admin's exact same transition rules.
function SuperAdminOrders({ focusStore }: SuperAdminOrdersProps) {
  const [stores, setStores] = useState<{ id: number; label: string }[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [overview, setOverview] = useState<OutstandingOrdersOverview | null>(null);

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null);
  const [entries, setEntries] = useState<OrderListEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');

  useEffect(() => {
    getAllStores()
      .then((all) => setStores(all.map((s) => ({ id: s.storeId, label: s.storeName, sublabel: `#${s.storeCode}` }))))
      .catch(() => {})
      .finally(() => setStoresLoading(false));
    getOutstandingOrders().then(setOverview).catch(() => {});
  }, []);

  function selectStore(storeId: number, storeName: string) {
    setSelectedStoreId(storeId);
    setSelectedStoreName(storeName);
    setSearch('');
    setStatusFilter('OPEN');
  }

  // Re-keyed off `focusStore` (not a plain initial value), the same way
  // OrderList.tsx's own seed prop works, so arriving here again from the Home
  // card re-selects even if the Super Admin has since picked a different
  // store by hand.
  const appliedFocusTs = useRef<number | null>(null);
  useEffect(() => {
    if (!focusStore || focusStore.ts === appliedFocusTs.current) return;
    appliedFocusTs.current = focusStore.ts;
    selectStore(focusStore.storeId, focusStore.storeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusStore]);

  useEffect(() => {
    if (selectedStoreId === null) {
      setEntries([]);
      return;
    }
    setEntriesLoading(true);
    setEntriesError(null);
    getOrderListForStore(selectedStoreId)
      .then(setEntries)
      .catch((error: Error) => setEntriesError(error.message))
      .finally(() => setEntriesLoading(false));
  }, [selectedStoreId]);

  async function handleStatusChange(entry: OrderListEntry, nextStatus: OrderStatus) {
    if (selectedStoreId === null) return;
    try {
      const updated = await updateSuperAdminOrderStatus(selectedStoreId, entry.id, nextStatus);
      setEntries((current) => current.map((e) => (e.id === updated.id ? updated : e)));
      nfToast.success(`"${updated.itemName}" marked as ${STATUS_META[nextStatus].label.toLowerCase()}.`);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to update order status');
    }
  }

  const matchesStatusFilter = (entry: OrderListEntry) =>
    statusFilter === 'OPEN' ? entry.status !== 'RECEIVED' : entry.status === statusFilter;

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => matchesStatusFilter(entry) && (!term || entry.itemName.toLowerCase().includes(term)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, search, statusFilter]);

  const openCount = useMemo(() => entries.filter((e) => e.status !== 'RECEIVED').length, [entries]);
  const needsCount = useMemo(() => entries.filter((e) => e.status === 'NEEDS_ORDERING').length, [entries]);
  const orderedCount = useMemo(() => entries.filter((e) => e.status === 'ORDERED').length, [entries]);
  const receivedCount = useMemo(() => entries.filter((e) => e.status === 'RECEIVED').length, [entries]);

  function pickStatusTile(next: StatusFilter) {
    setStatusFilter((current) => (current === next ? 'OPEN' : next));
  }

  return (
    <div className="super-admin-orders">
      <h1 className="super-admin-orders__title">Orders</h1>

      {overview !== null && overview.platformOutstandingCount > 0 && (
        <div className="super-admin-orders__overview">
          <div className="super-admin-orders__overview-head">
            <h2 className="super-admin-orders__section-title">Outstanding Across Stores</h2>
            <span className="super-admin-orders__overview-total">
              {overview.platformOutstandingCount} item{overview.platformOutstandingCount === 1 ? '' : 's'} across{' '}
              {overview.storesWithOutstanding} store{overview.storesWithOutstanding === 1 ? '' : 's'}
            </span>
          </div>
          <div className="super-admin-orders__overview-list">
            {overview.stores.map((store) => (
              <button
                key={store.storeId}
                type="button"
                className="super-admin-orders__overview-item"
                onClick={() => selectStore(store.storeId, store.storeName)}
              >
                <span className="super-admin-orders__overview-store">
                  <span className="super-admin-orders__overview-name">{store.storeName}</span>
                  <span className="super-admin-orders__overview-meta">#{store.storeCode} · {store.ownerName}</span>
                </span>
                <span className="super-admin-orders__overview-figures">
                  <span className="super-admin-orders__overview-count">{store.outstandingCount}</span>
                  <span className="super-admin-orders__overview-meta">oldest {formatOldest(store.oldestOutstandingAt)}</span>
                </span>
              </button>
            ))}
          </div>
          {overview.truncated && (
            <p className="super-admin-orders__overview-truncated">
              Showing the {overview.stores.length} stores with the most outstanding items, of {overview.storesWithOutstanding}.
            </p>
          )}
        </div>
      )}

      <div className="super-admin-orders__picker">
        <SearchableSelect
          id="super-admin-orders-store"
          options={stores}
          selectedIds={selectedStoreId === null ? [] : [selectedStoreId]}
          onChange={(ids) => {
            const id = ids[0] ?? null;
            if (id === null) {
              setSelectedStoreId(null);
              setSelectedStoreName(null);
              return;
            }
            const match = stores.find((s) => s.id === id);
            if (match) selectStore(id, match.label);
          }}
          placeholder="Select a store…"
          isLoading={storesLoading}
          emptyMessage="No stores found"
        />
      </div>

      {selectedStoreId !== null && (
        <div className="super-admin-orders__store">
          <h2 className="super-admin-orders__section-title">{selectedStoreName}</h2>

          <div className="stat-card-row">
            <StatCard icon={Layers} label="All Open" value={openCount} tone="primary" active={statusFilter === 'OPEN'} onClick={() => pickStatusTile('OPEN')} />
            <StatCard icon={PackageSearch} label="Needs Ordering" value={needsCount} tone="warning" active={statusFilter === 'NEEDS_ORDERING'} onClick={() => pickStatusTile('NEEDS_ORDERING')} />
            <StatCard icon={Truck} label="Ordered" value={orderedCount} tone="info" active={statusFilter === 'ORDERED'} onClick={() => pickStatusTile('ORDERED')} />
            <StatCard icon={PackageCheck} label="Received" value={receivedCount} tone="success" active={statusFilter === 'RECEIVED'} onClick={() => pickStatusTile('RECEIVED')} />
          </div>

          <div className="super-admin-orders__filter-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Search items" variant="surface" />
            <Select
              className="super-admin-orders__status-select"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              ariaLabel="Status"
            />
          </div>

          {entriesError && (
            <div className="super-admin-orders__error">{entriesError}</div>
          )}
          {entriesLoading && <div className="super-admin-orders__loading">Loading...</div>}
          {!entriesLoading && !entriesError && filteredEntries.length === 0 && (
            <div className="super-admin-orders__empty">No orders match these filters.</div>
          )}
          {!entriesLoading && !entriesError && filteredEntries.length > 0 && (
            <div className="super-admin-orders__list">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="super-admin-orders__row">
                  <div className="super-admin-orders__row-main">
                    <span className="super-admin-orders__row-name">{entry.itemName}</span>
                    <span className="super-admin-orders__row-meta">
                      {entry.quantityNeeded} {entry.unitOfMeasurement}
                      {entry.supplierName ? ` · ${entry.supplierName}` : ''}
                    </span>
                  </div>
                  <StatusDotMenu
                    options={STATUS_OPTIONS}
                    value={entry.status}
                    onChange={(value) => handleStatusChange(entry, value as OrderStatus)}
                    ariaLabel={`Change status for ${entry.itemName}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedStoreId === null && (
        <p className="super-admin-orders__hint">Select a store above to view and manage its order list.</p>
      )}
    </div>
  );
}

export default SuperAdminOrders;
