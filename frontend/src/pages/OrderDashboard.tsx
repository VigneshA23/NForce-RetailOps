import { useEffect, useMemo, useState } from 'react';
import { Clipboard, PackageCheck, PackageSearch, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getOrderList, updateOrderListEntry } from '../api/orderList';
import { getOwnerSuppliers } from '../api/suppliers';
import type { OrderListEntry, OrderStatus, UpdateOrderListEntryValues } from '../types/orderList';
import type { Supplier } from '../types/supplier';
import { buildOrderListText } from '../utils/orderListExport';
import OrderListEntryEditModal from '../components/OrderListEntryEditModal';
import Select from '../components/Select';
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
}

function OrderDashboard({ storeName }: OrderDashboardProps) {
  const [entries, setEntries] = useState<OrderListEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [editTarget, setEditTarget] = useState<OrderListEntry | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

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

  async function handleCopyList() {
    const text = buildOrderListText(entries, storeName);
    try {
      await navigator.clipboard.writeText(text);
      nfToast.success('Order list copied to clipboard.');
    } catch {
      nfToast.error('Could not copy to clipboard. Please copy manually.');
    }
  }

  const needsOrderingCount = useMemo(() => entries.filter((e) => e.status === 'NEEDS_ORDERING').length, [entries]);
  const orderedCount = useMemo(() => entries.filter((e) => e.status === 'ORDERED').length, [entries]);
  const receivedCount = useMemo(() => entries.filter((e) => e.status === 'RECEIVED').length, [entries]);

  const filteredEntries = statusFilter === 'ALL' ? entries : entries.filter((e) => e.status === statusFilter);

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
        <div className="filter-bar order-dashboard-page__filter-bar">
          <Select
            className="filter filter--narrow"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filter by status"
          />
        </div>
        <button type="button" className="btn btn--secondary" onClick={handleCopyList}>
          <Clipboard size={16} />
          Copy Order List
        </button>
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
                        <button type="button" className="table-icon-btn" title="Mark Ordered" onClick={() => handleQuickAdvance(entry, 'ORDERED')}>
                          Mark Ordered
                        </button>
                      )}
                      {entry.status === 'ORDERED' && (
                        <button type="button" className="table-icon-btn" title="Mark Received" onClick={() => handleQuickAdvance(entry, 'RECEIVED')}>
                          Mark Received
                        </button>
                      )}
                      <button
                        type="button"
                        className="table-icon-btn"
                        aria-label={`Edit ${entry.itemName}`}
                        title="Edit"
                        onClick={() => { setEditError(null); setEditTarget(entry); }}
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
    </div>
  );
}

export default OrderDashboard;
