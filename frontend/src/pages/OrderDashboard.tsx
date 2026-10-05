import { useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, ClipboardList, Pencil, PackageCheck, PackageSearch, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getOrderList, updateOrderListEntry } from '../api/orderList';
import { getOwnerSuppliers } from '../api/suppliers';
import type { OrderListEntry, OrderStatus, UpdateOrderListEntryValues } from '../types/orderList';
import type { Supplier } from '../types/supplier';
import { buildOrderListText, buildReorderListText } from '../utils/orderListExport';
import OrderListEntryEditModal from '../components/OrderListEntryEditModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Select from '../components/Select';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import StatCard from '../components/StatCard';
import './OrderDashboard.css';

const STATUS_BADGE: Record<OrderStatus, string> = {
  NEEDS_ORDERING: 'badge--danger',
  ORDERED: 'badge--warning',
  RECEIVED: 'badge--success',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEEDS_ORDERING: 'Needs Ordering',
  ORDERED: 'Ordered',
  RECEIVED: 'Received',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'NEEDS_ORDERING', label: 'Needs Ordering' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
];

interface OrderDashboardProps {
  storeName?: string | null;
  // Set by the shell when arriving from the Home low-stock tile, to open this
  // tab already filtered. `id` is a nonce, not data -- see the effect below.
  seed?: { status: string; id: number };
}

function OrderDashboard({ storeName, seed }: OrderDashboardProps) {
  const [entries, setEntries] = useState<OrderListEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [itemFilter, setItemFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [editTarget, setEditTarget] = useState<OrderListEntry | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const [advanceTarget, setAdvanceTarget] = useState<{ entry: OrderListEntry; nextStatus: OrderStatus } | null>(null);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getOrderList(), getOwnerSuppliers()])
      .then(([list, sups]) => {
        setEntries(list);
        setSuppliers(sups);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // The owner shell keeps this tab mounted and merely hidden, so arriving here
  // from the Home tile does NOT remount -- the filter has to be applied by an
  // effect rather than an initial useState. Retiring each request by its nonce
  // (the house pattern, same as searchSeed and focusIssueId) is what stops a
  // later re-render re-applying the filter after the user has changed it by
  // hand. It deliberately does not reset the filter afterwards: that value is
  // the user's now, and persists exactly like any filter they set themselves.
  const appliedSeedId = useRef<number | null>(null);
  useEffect(() => {
    if (!seed || seed.id === appliedSeedId.current) return;
    appliedSeedId.current = seed.id;
    setStatusFilter(seed.status);
  }, [seed]);

  async function handleEditSubmit(values: UpdateOrderListEntryValues) {
    if (!editTarget) return;
    setEditError(null);
    setIsEditSubmitting(true);
    try {
      const updated = await updateOrderListEntry(editTarget.id, values);
      setEntries((current) => current.map((e) => (e.id === updated.id ? updated : e)));
      nfToast.success(`"${updated.itemName}" order updated.`);
      setEditTarget(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update order';
      setEditError(msg);
      nfToast.error(msg);
    } finally {
      setIsEditSubmitting(false);
    }
  }

  async function handleQuickAdvance(entry: OrderListEntry, nextStatus: OrderStatus) {
    try {
      const updated = await updateOrderListEntry(entry.id, {
        quantityNeeded: String(entry.quantityNeeded),
        supplierId: entry.supplierId,
        note: entry.note ?? '',
        status: nextStatus,
      });
      setEntries((current) => current.map((e) => (e.id === updated.id ? updated : e)));
      nfToast.success(`"${entry.itemName}" marked as ${STATUS_LABEL[nextStatus].toLowerCase()}.`);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to update order status');
    }
  }

  // The table-icon-btn only opens a confirmation -- it's handleConfirmAdvance
  // below, wired to ConfirmDialog, that actually calls handleQuickAdvance.
  async function handleConfirmAdvance() {
    if (!advanceTarget) return;
    await handleQuickAdvance(advanceTarget.entry, advanceTarget.nextStatus);
    setAdvanceTarget(null);
  }

  async function handleCopyList() {
    const text = buildOrderListText(entries, storeName, new Date());
    try {
      await navigator.clipboard.writeText(text);
      nfToast.success('Order list copied to clipboard.');
    } catch {
      nfToast.error('Could not copy to clipboard. Please copy manually.');
    }
  }

  // Built from `entries` at click time (not a value computed on every
  // render and stashed in state), so it's always the current live data --
  // never a stale list from before the last refresh.
  async function handleCopyReorderList() {
    const text = buildReorderListText(entries, storeName, new Date());
    if (text == null) {
      nfToast.info('No items currently need ordering.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      nfToast.success('Reorder list copied.');
    } catch {
      nfToast.error('Could not copy to clipboard. Please copy manually.');
    }
  }

  const needsOrderingCount = useMemo(() => entries.filter((e) => e.status === 'NEEDS_ORDERING').length, [entries]);
  const orderedCount = useMemo(() => entries.filter((e) => e.status === 'ORDERED').length, [entries]);
  const receivedCount = useMemo(() => entries.filter((e) => e.status === 'RECEIVED').length, [entries]);

  // Drawn from the live entries themselves, not a separate item catalog --
  // only items that actually appear on this store's order list are worth
  // filtering by. De-duplicated by storeInventoryItemId since the same item
  // can only ever have one active entry, but its status can still change it
  // in and out of view as the filter is applied.
  const itemFilterOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const entry of entries) {
      if (!byId.has(entry.storeInventoryItemId)) byId.set(entry.storeInventoryItemId, entry.itemName);
    }
    const items = [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
    return [
      { value: 'ALL', label: 'All Items' },
      ...items.map(([id, name]) => ({ value: String(id), label: name })),
    ];
  }, [entries]);

  // Drawn from the store's full supplier list (fetched alongside the order
  // list for the edit modal), the same way Tasks' category filter draws from
  // the full category list rather than only categories in view.
  const supplierFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Suppliers' },
      ...[...suppliers]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((supplier) => ({ value: String(supplier.id), label: supplier.name })),
      { value: 'UNASSIGNED', label: 'Unassigned Supplier' },
    ],
    [suppliers],
  );

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (normalizedSearch && !entry.itemName.toLowerCase().includes(normalizedSearch)) return false;
      if (itemFilter !== 'ALL' && String(entry.storeInventoryItemId) !== itemFilter) return false;
      if (supplierFilter === 'UNASSIGNED' && entry.supplierId != null) return false;
      if (supplierFilter !== 'ALL' && supplierFilter !== 'UNASSIGNED' && String(entry.supplierId) !== supplierFilter) return false;
      if (statusFilter !== 'ALL' && entry.status !== statusFilter) return false;
      return true;
    });
  }, [entries, search, itemFilter, supplierFilter, statusFilter]);

  function clearFilters() {
    setSearch('');
    setItemFilter('ALL');
    setSupplierFilter('ALL');
    setStatusFilter('ALL');
  }

  if (loadError) {
    return (
      <div className="order-dashboard-page">
        <div className="order-dashboard-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="order-dashboard-page">
      <div className="stat-card-row">
        <StatCard icon={PackageSearch} label="Needs Ordering" value={needsOrderingCount} tone="warning" />
        <StatCard icon={Truck} label="Ordered" value={orderedCount} tone="info" />
        <StatCard icon={PackageCheck} label="Received" value={receivedCount} tone="success" />
      </div>

      <div className="order-dashboard-page__header">
        <div className="order-dashboard-page__header-actions">
          <button type="button" className="btn btn--secondary" onClick={handleCopyList}>
            <Clipboard size={16} />
            Copy Order List
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleCopyReorderList}
            disabled={isLoading || needsOrderingCount === 0}
          >
            <ClipboardList size={16} />
            Copy Reorder List
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search items" variant="filter" />
        </div>

        <Select
          className="filter"
          options={itemFilterOptions}
          value={itemFilter}
          onChange={setItemFilter}
          ariaLabel="Filter by item"
        />

        <Select
          className="filter"
          options={supplierFilterOptions}
          value={supplierFilter}
          onChange={setSupplierFilter}
          ariaLabel="Filter by supplier"
        />

        <Select
          className="filter filter--narrow"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by status"
        />
        <FilterClearButton onClick={clearFilters} />
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Quantity</th>
                <th scope="col">Supplier</th>
                <th scope="col">Status</th>
                <th scope="col">Source</th>
                <th scope="col" className="order-dashboard-page__actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Item">{entry.itemName}</td>
                  <td data-label="Quantity">{entry.quantityNeeded} {entry.unitOfMeasurement}</td>
                  <td data-label="Supplier">{entry.supplierName ?? '—'}</td>
                  <td data-label="Status">
                    <span className={`badge ${STATUS_BADGE[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>
                  </td>
                  <td data-label="Source">{entry.adHoc ? 'Ad-hoc' : 'Auto'}</td>
                  <td className="table-actions-cell" data-label="Actions">
                    <div className="table-row-actions">
                      {entry.status === 'NEEDS_ORDERING' && (
                        <button
                          type="button"
                          className="table-icon-btn"
                          aria-label={`Mark ${entry.itemName} ordered`}
                          title="Mark Ordered"
                          onClick={() => setAdvanceTarget({ entry, nextStatus: 'ORDERED' })}
                        >
                          <Truck size={16} />
                        </button>
                      )}
                      {entry.status === 'ORDERED' && (
                        <button
                          type="button"
                          className="table-icon-btn"
                          aria-label={`Mark ${entry.itemName} received`}
                          title="Mark Received"
                          onClick={() => setAdvanceTarget({ entry, nextStatus: 'RECEIVED' })}
                        >
                          <PackageCheck size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="table-icon-btn"
                        aria-label={`Edit ${entry.itemName}`}
                        title="Edit"
                        onClick={() => { setEditError(null); setEditTarget(entry); }}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredEntries.length === 0 && (
          <div className="order-dashboard-page__empty">
            {entries.length === 0 ? 'No order-list entries yet.' : 'No entries match this filter.'}
          </div>
        )}
        {isLoading && <div className="order-dashboard-page__empty">Loading...</div>}
      </div>

      <OrderListEntryEditModal
        isOpen={editTarget !== null}
        entry={editTarget}
        suppliers={suppliers}
        errorMessage={editError}
        isSubmitting={isEditSubmitting}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        isOpen={advanceTarget !== null}
        title={advanceTarget?.nextStatus === 'ORDERED' ? 'Mark as Ordered?' : 'Mark as Received?'}
        message={
          advanceTarget
            ? `Mark "${advanceTarget.entry.itemName}" as ${STATUS_LABEL[advanceTarget.nextStatus].toLowerCase()}?`
            : ''
        }
        confirmLabel={advanceTarget?.nextStatus === 'ORDERED' ? 'Mark Ordered' : 'Mark Received'}
        danger={false}
        onConfirm={handleConfirmAdvance}
        onCancel={() => setAdvanceTarget(null)}
      />
    </div>
  );
}

export default OrderDashboard;
