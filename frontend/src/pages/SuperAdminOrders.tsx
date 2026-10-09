import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, CircleCheck, Clipboard, Layers, List, PackageCheck, PackageSearch, Plus, Truck } from 'lucide-react';
import { ApiError } from '../api/client';
import { getAllStores } from '../api/superAdminStores';
import { getAllInventoryItems } from '../api/inventoryItems';
import { getSuppliers } from '../api/suppliers';
import {
  createSuperAdminOrderListEntry,
  getOrderListForStore,
  updateSuperAdminOrderStatus,
} from '../api/superAdminOperations';
import type { CreateOrderListEntryValues, OrderListEntry, OrderStatus } from '../types/orderList';
import type { Supplier } from '../types/supplier';
import type { InventoryItemCategory } from '../types/storeInventory';
import { buildCategoryOptions, categoryLabel as categoryLabelOf } from '../types/storeInventory';
import { buildOrderListText } from '../utils/orderListExport';
import { STATUS_META, STATUS_ORDER } from '../utils/orderListStatus';
import AddToOrderPanel, { type OrderableInventoryItem } from '../components/AddToOrderPanel';
import OrderAlreadyUpdatedModal from '../components/OrderAlreadyUpdatedModal';
import SuperAdminInventoryCounts from '../components/SuperAdminInventoryCounts';
import SuperAdminEodSupplierReport from '../components/SuperAdminEodSupplierReport';
import SuperAdminOrdersPurchaseReport from '../components/SuperAdminOrdersPurchaseReport';
import StatCard from '../components/StatCard';
import CategoryIcon, { CATEGORY_VISUAL, FALLBACK_CATEGORY_VISUAL } from '../components/CategoryIcon';
import CheckboxButton from '../components/CheckboxButton';
import StatusDotMenu from '../components/StatusDotMenu';
import ChangeOrderStatusModal from '../components/ChangeOrderStatusModal';
import { roundQty } from '../utils/quantity';
import { describeReceipt } from '../utils/orderReceipt';
import BulkChangeOrderStatusModal, { type BulkStatusChangeItem } from '../components/BulkChangeOrderStatusModal';
import SearchableSelect from '../components/SearchableSelect';
import Select from '../components/Select';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import { useIsMobile } from '../hooks/useMediaQuery';
import { nfToast } from '../utils/toast';
import '../pages/OrderList.css';
import '../pages/OrderDashboard.css';
import './SuperAdminOrders.css';

type StatusFilter = 'OPEN' | OrderStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'All open' },
  { value: 'NEEDS_ORDERING', label: 'Needs ordering' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
];

type SubTab = 'orders' | 'counts' | 'eod-report' | 'purchasing-report';

// Mirrors Owner/Admin's OrderDashboard.tsx sub-tab set and labels exactly
// (RTS-304 parity) -- shortLabel is what mobile shows, same reasoning as
// that file's own comment on why these full labels don't fit a 4-way pill at
// phone width.
const SUB_TABS: { key: SubTab; label: string; shortLabel: string }[] = [
  { key: 'orders', label: 'Order List', shortLabel: 'Orders' },
  { key: 'counts', label: 'Inventory Counts', shortLabel: 'Inventory' },
  { key: 'eod-report', label: 'End of Day Report', shortLabel: 'Report' },
  { key: 'purchasing-report', label: 'Supplier Purchasing Summary', shortLabel: 'Purchases' },
];

const GROUP_ROW_LIMIT = 5;
const MOBILE_GROUP_ROW_LIMIT = 3;
const UNASSIGNED_GROUP_LABEL = 'Unassigned Supplier';

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

// Super Admin's cross-store Orders page (RTS-307, aligned to Owner/Admin's
// layout per RTS-304). Same grouped/flat ordering workbench as OrderList.tsx
// -- supplier grouping, bulk status changes, Add to order, clipboard export --
// scoped to whichever store is currently selected, plus the dashboard-style
// sub-tabs (Order List/Inventory Counts/End of Day Report/Purchasing
// Summary) and the store picker only Super Admin needs.
function SuperAdminOrders({ focusStore }: SuperAdminOrdersProps) {
  const [stores, setStores] = useState<{ id: number; label: string }[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allInventoryItems, setAllInventoryItems] = useState<{
    id: number; storeId: number; name: string; unitOfMeasurement: string; preferredSupplierId: number | null;
    category: InventoryItemCategory | null; currentAvailable: number | null; requiredToday: number | null;
  }[]>([]);

  const [subTab, setSubTab] = useState<SubTab>('orders');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null);
  const [entries, setEntries] = useState<OrderListEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  // Set when a status change is rejected because the Owner/Admin already
  // updated the entry (HTTP 409) -- drives OrderAlreadyUpdatedModal.
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [grouped, setGrouped] = useState(true);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({});

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);

  // Same confirm-before-applying pattern as OrderList.tsx -- one click on the
  // wrong dropdown option, or the wrong bulk button, should not silently mark
  // an order received by accident.
  const [pendingStatusChange, setPendingStatusChange] = useState<{ entry: OrderListEntry; nextStatus: OrderStatus } | null>(null);
  const [pendingBulkStatusChange, setPendingBulkStatusChange] = useState<{ ids: number[]; nextStatus: OrderStatus } | null>(null);

  const isMobile = useIsMobile();

  useEffect(() => {
    getAllStores()
      .then((all) => setStores(all.map((s) => ({ id: s.storeId, label: s.storeName, sublabel: `#${s.storeCode}` }))))
      .catch(() => {})
      .finally(() => setStoresLoading(false));
    getSuppliers().then(setSuppliers).catch(() => {});
    getAllInventoryItems()
      .then((items) => setAllInventoryItems(items.filter((i) => i.active)))
      .catch(() => {});
  }, []);

  function selectStore(storeId: number, storeName: string) {
    setSelectedStoreId(storeId);
    setSelectedStoreName(storeName);
    setSearch('');
    setCategoryFilter('all');
    setSupplierFilter('all');
    setStatusFilter('OPEN');
    setSelectedIds(new Set());
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
    setSubTab('orders');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusStore]);

  function loadEntries() {
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
  }

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  function applyUpdatedEntry(updated: OrderListEntry) {
    setEntries((current) => {
      const index = current.findIndex((e) => e.id === updated.id);
      return index === -1 ? [...current, updated] : current.map((e) => (e.id === updated.id ? updated : e));
    });
  }

  async function handleAddSubmit(values: CreateOrderListEntryValues) {
    if (selectedStoreId === null) return;
    setAddError(null);
    setIsAddSubmitting(true);
    try {
      const created = await createSuperAdminOrderListEntry(selectedStoreId, values);
      applyUpdatedEntry(created);
      nfToast.success(`"${created.itemName}" added to the order list.`);
      setIsAddOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to add to order list';
      setAddError(msg);
      nfToast.error(msg);
    } finally {
      setIsAddSubmitting(false);
    }
  }

  // Returns the saved entry, or null when the change did not go through.
  async function changeStatus(entry: OrderListEntry, nextStatus: OrderStatus, quantityReceived?: number) {
    if (selectedStoreId === null) return null;
    try {
      const updated = await updateSuperAdminOrderStatus(selectedStoreId, entry.id, nextStatus, entry.status, quantityReceived);
      applyUpdatedEntry(updated);
      return updated;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // The Owner/Admin already moved this entry -- tell the user and pull
        // the fresh list rather than leaving a stale row on screen.
        setConflictMessage(error.message);
        getOrderListForStore(selectedStoreId).then(setEntries).catch(() => {});
        return null;
      }
      nfToast.error(error instanceof Error ? error.message : 'Failed to update order status');
      return null;
    }
  }

  // Receiving a delivery may raise a new order for what is still missing, so
  // the store's list is re-read afterwards.
  function refreshAfterReceipt() {
    if (selectedStoreId === null) return;
    getOrderListForStore(selectedStoreId).then(setEntries).catch(() => {});
  }

  async function handleStatusChange(entry: OrderListEntry, nextStatus: OrderStatus, quantityReceived?: number) {
    const updated = await changeStatus(entry, nextStatus, quantityReceived);
    if (!updated) return;
    if (updated.receipt) {
      const { tone, message } = describeReceipt(entry.itemName, updated.quantityReceived ?? null, entry.unitOfMeasurement, updated.receipt);
      nfToast[tone](message);
      refreshAfterReceipt();
      return;
    }
    nfToast.success(`"${entry.itemName}" marked as ${STATUS_META[nextStatus].label.toLowerCase()}.`);
  }

  function requestStatusChange(entry: OrderListEntry, nextStatus: OrderStatus) {
    if (nextStatus === entry.status) return;
    setPendingStatusChange({ entry, nextStatus });
  }

  async function confirmPendingStatusChange(quantityReceived?: number) {
    if (!pendingStatusChange) return;
    await handleStatusChange(pendingStatusChange.entry, pendingStatusChange.nextStatus, quantityReceived);
    setPendingStatusChange(null);
  }

  async function bulkSetStatus(ids: number[], nextStatus: OrderStatus) {
    const targets = entries.filter((e) => ids.includes(e.id));
    if (targets.length === 0) return;
    const results = await Promise.allSettled(targets.map((entry) => changeStatus(entry, nextStatus)));
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    if (nextStatus === 'RECEIVED' && successCount > 0) refreshAfterReceipt();
    if (successCount > 0) {
      nfToast.success(`${successCount} item${successCount === 1 ? '' : 's'} marked as ${STATUS_META[nextStatus].label.toLowerCase()}.`);
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  // Only the row directly below the target status can actually move to it in
  // one step (see OrderListService.ALLOWED_TRANSITIONS) -- a mixed selection
  // (e.g. some already Ordered, some still Needs ordering) silently skips
  // anything else rather than sending the whole batch through.
  function eligibleIdsForBulkStatus(ids: number[], nextStatus: OrderStatus): number[] {
    const fromStatus: OrderStatus = nextStatus === 'ORDERED' ? 'NEEDS_ORDERING' : 'ORDERED';
    return entries.filter((e) => ids.includes(e.id) && e.status === fromStatus).map((e) => e.id);
  }

  function requestBulkStatusChange(ids: number[], nextStatus: OrderStatus) {
    const eligible = eligibleIdsForBulkStatus(ids, nextStatus);
    if (eligible.length === 0) {
      nfToast.info('None of the selected items can move to that status.');
      return;
    }
    setPendingBulkStatusChange({ ids, nextStatus });
  }

  async function confirmPendingBulkStatusChange() {
    if (!pendingBulkStatusChange) return;
    const eligible = eligibleIdsForBulkStatus(pendingBulkStatusChange.ids, pendingBulkStatusChange.nextStatus);
    await bulkSetStatus(eligible, pendingBulkStatusChange.nextStatus);
    setPendingBulkStatusChange(null);
  }

  async function copyText(text: string | null, emptyMessage: string, successMessage: string) {
    if (text == null) {
      nfToast.info(emptyMessage);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      nfToast.success(successMessage);
    } catch {
      nfToast.error('Could not copy to clipboard. Please copy manually.');
    }
  }

  async function handleCopySelected() {
    const selected = entries.filter((e) => selectedIds.has(e.id));
    await copyText(buildOrderListText(selected, selectedStoreName, new Date()), 'No items selected.', 'Selected items copied to clipboard.');
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setGroupSelected(ids: number[], on: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  // Store-scoped slice of the cross-store catalog -- getAllInventoryItems()
  // already carries category/currentAvailable/requiredToday per item, so this
  // substitutes for Owner/Admin's separate getStoreInventoryItems/
  // getInventoryCounts pair without a second endpoint.
  const storeInventoryItems = useMemo(
    () => (selectedStoreId == null ? [] : allInventoryItems.filter((i) => i.storeId === selectedStoreId)),
    [allInventoryItems, selectedStoreId],
  );
  const inventoryItems: OrderableInventoryItem[] = useMemo(
    () => storeInventoryItems.map((i) => ({ id: i.id, name: i.name, unitOfMeasurement: i.unitOfMeasurement, preferredSupplierId: i.preferredSupplierId })),
    [storeInventoryItems],
  );
  const stockByItemId = useMemo(
    () => new Map(storeInventoryItems.map((i) => [i.id, { current: i.currentAvailable, minimum: i.requiredToday }])),
    [storeInventoryItems],
  );
  const categoryByItemId = useMemo(
    () => new Map(storeInventoryItems.map((i) => [i.id, i.category])),
    [storeInventoryItems],
  );

  const matchesStatusFilter = (entry: OrderListEntry) =>
    statusFilter === 'OPEN' ? entry.status !== 'RECEIVED' : entry.status === statusFilter;

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!matchesStatusFilter(entry)) return false;
      if (normalizedSearch && !entry.itemName.toLowerCase().includes(normalizedSearch)) return false;
      if (categoryFilter !== 'all' && categoryByItemId.get(entry.storeInventoryItemId) !== categoryFilter) return false;
      if (supplierFilter === 'UNASSIGNED' && entry.supplierId != null) return false;
      if (supplierFilter !== 'all' && supplierFilter !== 'UNASSIGNED' && String(entry.supplierId) !== supplierFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, search, categoryFilter, categoryByItemId, supplierFilter, statusFilter]);

  function decorate(entry: OrderListEntry) {
    const stock = stockByItemId.get(entry.storeInventoryItemId);
    const category = categoryByItemId.get(entry.storeInventoryItemId) ?? null;
    const meta = STATUS_META[entry.status];
    const categoryLabel = categoryLabelOf(category) || '—';
    const categoryVisual = category ? (CATEGORY_VISUAL[category] ?? FALLBACK_CATEGORY_VISUAL) : FALLBACK_CATEGORY_VISUAL;
    const raisedBy = entry.raisedByName ?? (entry.adHoc ? 'Manual' : 'Auto-detected');
    return {
      entry,
      category,
      categoryLabel,
      categoryVisual,
      onHand: stock?.current ?? null,
      par: stock?.minimum ?? null,
      needFg: entry.status === 'NEEDS_ORDERING' ? '#b3162a' : '#18181b',
      meta: entry.note ? `${raisedBy} · ${entry.note}` : raisedBy,
      mobileMeta: `${raisedBy} · ${new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`,
      statusLabel: meta.label,
      statusDot: meta.fg,
      statusFg: meta.fg,
      statusBg: meta.bg,
      checked: selectedIds.has(entry.id),
      statusOptions: STATUS_ORDER.map((key) => ({ value: key, label: STATUS_META[key].label, dot: STATUS_META[key].fg })),
    };
  }

  const decorated = useMemo(() => filteredEntries.map(decorate), [filteredEntries, stockByItemId, selectedIds]);

  // What "Add to order" needs to show its "Already needs N" hint -- at most
  // one active (non-RECEIVED) entry per item, same invariant the backend
  // enforces (see OrderListService.doUpsertShortage).
  const activeNeedByItemId = useMemo(() => {
    const map = new Map<number, { quantityNeeded: number; manualAddition: number }>();
    for (const e of entries) {
      if (e.status !== 'RECEIVED') {
        map.set(e.storeInventoryItemId, { quantityNeeded: e.quantityNeeded, manualAddition: e.manualAddition });
      }
    }
    return map;
  }, [entries]);

  const supplierFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All suppliers' },
      ...[...suppliers]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((supplier) => ({ value: String(supplier.id), label: supplier.name })),
      { value: 'UNASSIGNED', label: 'Unassigned Supplier' },
    ],
    [suppliers],
  );

  const groups = useMemo(() => {
    const named = new Map<string, typeof decorated>();
    const unassigned: typeof decorated = [];
    for (const row of decorated) {
      if (row.entry.supplierId == null || !row.entry.supplierName) {
        unassigned.push(row);
        continue;
      }
      const key = String(row.entry.supplierId);
      const bucket = named.get(key) ?? [];
      bucket.push(row);
      named.set(key, bucket);
    }
    const result = [...named.entries()]
      .map(([key, items]) => ({ key, name: items[0].entry.supplierName!, items }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    if (unassigned.length > 0) result.push({ key: 'UNASSIGNED', name: UNASSIGNED_GROUP_LABEL, items: unassigned });

    const rowLimit = isMobile ? MOBILE_GROUP_ROW_LIMIT : GROUP_ROW_LIMIT;
    return result.map((group) => {
      const needs = group.items.filter((row) => row.entry.status === 'NEEDS_ORDERING');
      const done = group.items.length - needs.length;
      const isOpen = groupOpen[group.key] ?? needs.length > 0;
      const isExpanded = groupExpanded[group.key] ?? false;
      const selectedCount = group.items.filter((row) => row.checked).length;
      return {
        ...group,
        needsCount: needs.length,
        isOpen,
        shown: isExpanded ? group.items : group.items.slice(0, rowLimit),
        hasMore: group.items.length > rowLimit,
        moreLabel: isExpanded ? 'Show less' : `Show all ${group.items.length} items`,
        summary: `${group.items.length} item${group.items.length === 1 ? '' : 's'} · ${needs.length ? `${needs.length} to order` : 'nothing left to order'}`,
        progress: `${done} of ${group.items.length} ordered`,
        mobileProgress: `${done}/${group.items.length} ordered`,
        mobileSummary: needs.length ? `${needs.length} to order` : 'All ordered',
        pct: `${Math.round((done / group.items.length) * 100)}%`,
        barColor: needs.length ? '#1d5fb8' : '#16a34a',
        canBulk: needs.length > 0,
        allDone: needs.length === 0,
        checked: selectedCount === group.items.length && group.items.length > 0,
        indeterminate: selectedCount > 0 && selectedCount < group.items.length,
      };
    });
  }, [decorated, groupOpen, groupExpanded, isMobile]);

  const allChecked = decorated.length > 0 && decorated.every((row) => row.checked);
  const someChecked = decorated.some((row) => row.checked);

  function toggleSelectAll() {
    setGroupSelected(decorated.map((row) => row.entry.id), !allChecked);
  }

  const hasActiveFilters = search !== '' || categoryFilter !== 'all' || supplierFilter !== 'all' || statusFilter !== 'OPEN';
  function clearFilters() {
    setSearch('');
    setCategoryFilter('all');
    setSupplierFilter('all');
    setStatusFilter('OPEN');
  }

  const openCount = useMemo(() => entries.filter((e) => e.status !== 'RECEIVED').length, [entries]);
  const needsCount = useMemo(() => entries.filter((e) => e.status === 'NEEDS_ORDERING').length, [entries]);
  const orderedCount = useMemo(() => entries.filter((e) => e.status === 'ORDERED').length, [entries]);
  const receivedCount = useMemo(() => entries.filter((e) => e.status === 'RECEIVED').length, [entries]);

  function pickStatusTile(next: StatusFilter) {
    setStatusFilter((current) => (current === next ? 'OPEN' : next));
  }

  const bulkEligibleItems: BulkStatusChangeItem[] = pendingBulkStatusChange
    ? eligibleIdsForBulkStatus(pendingBulkStatusChange.ids, pendingBulkStatusChange.nextStatus)
        .map((id) => entries.find((e) => e.id === id))
        .filter((e): e is OrderListEntry => e != null)
        .map((entry) => {
          const row = decorate(entry);
          return {
            id: entry.id,
            itemName: entry.itemName,
            quantityLabel: `${entry.quantityNeeded + entry.manualAddition} ${entry.unitOfMeasurement}`,
            meta: row.meta,
            category: row.category,
            imageId: entry.imageId,
          };
        })
    : [];
  const bulkSkippedCount = pendingBulkStatusChange ? pendingBulkStatusChange.ids.length - bulkEligibleItems.length : 0;

  // Ordered column: the full quantity placed with the supplier (need plus any
  // surplus the admin added), shown once the entry has moved past NEEDS_ORDERING.
  // Matches Owner/Admin's OrderList.tsx exactly, which this page otherwise mirrors.
  function orderedCell(entry: OrderListEntry) {
    if (entry.status === 'NEEDS_ORDERING') return <span className="order-list__manual-empty">—</span>;
    return (
      <>
        {entry.quantityNeeded + entry.manualAddition} <span className="order-list__unit">{entry.unitOfMeasurement}</span>
      </>
    );
  }

  function renderMobileCard(row: ReturnType<typeof decorate>) {
    const { entry } = row;
    return (
      <tr
        key={entry.id}
        className="order-list__row"
        style={row.checked ? { background: '#fff5f6', borderColor: '#f6b9c2' } : undefined}
      >
        <td className="order-list__mobile-card-td">
          <div className="order-list__mobile-card-header">
            <CheckboxButton checked={row.checked} ariaLabel={`Select ${entry.itemName}`} onClick={() => toggleSelected(entry.id)} />
            <CategoryIcon category={row.category} name={entry.itemName} size={44} imageId={entry.imageId} />
            <div className="order-list__item-text">
              <div className="order-list__item-name">
                <span className="order-list__item-name-text">{entry.itemName}</span>
              </div>
              <div className="order-list__item-mobile-meta">{row.mobileMeta}</div>
            </div>
          </div>
          <div className="order-list__mobile-stats">
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Stock</span>
              <span className="order-list__cell-value">
                <span className="order-list__on-hand">{row.onHand ?? '—'}</span>
                <span className="order-list__par"> / {row.par ?? '—'}</span>
              </span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Need</span>
              <span className="order-list__cell-value" style={{ color: row.needFg, fontWeight: 800 }}>
                {entry.quantityNeeded} <span className="order-list__unit">{entry.unitOfMeasurement}</span>
              </span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Manual</span>
              <span className="order-list__cell-value">
                {entry.manualAddition > 0 ? (
                  <span className="order-list__manual-value">
                    +{entry.manualAddition} <span className="order-list__unit">{entry.unitOfMeasurement}</span>
                  </span>
                ) : (
                  <span className="order-list__manual-empty">—</span>
                )}
              </span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Ordered</span>
              <span className="order-list__cell-value">{orderedCell(entry)}</span>
            </div>
          </div>
          <div className="order-list__mobile-footer">
            <span className="order-list__mobile-pill" style={{ background: row.categoryVisual.bg, color: row.categoryVisual.fg }}>
              <span className="order-list__mobile-pill-dot" style={{ background: row.categoryVisual.fg }} />
              {row.categoryLabel}
            </span>
            <StatusDotMenu
              options={row.statusOptions}
              value={entry.status}
              onChange={(value) => requestStatusChange(entry, value as OrderStatus)}
              ariaLabel={`Change status for ${entry.itemName}`}
              background={row.statusBg}
              color={row.statusFg}
            />
          </div>
        </td>
      </tr>
    );
  }

  function renderRow(row: ReturnType<typeof decorate>, variant: 'grouped' | 'flat') {
    const { entry } = row;
    const isFlat = variant === 'flat';
    if (isMobile) return renderMobileCard(row);
    return (
      <tr key={entry.id} className="order-list__row" style={{ background: row.checked ? '#fff5f6' : undefined }}>
        <td className="order-list__checkbox-cell">
          <CheckboxButton checked={row.checked} ariaLabel={`Select ${entry.itemName}`} onClick={() => toggleSelected(entry.id)} />
        </td>
        <td className="order-list__item-td">
          <div className="order-list__item-cell">
            <CategoryIcon category={row.category} name={entry.itemName} size={isFlat ? 48 : 56} imageId={entry.imageId} />
            <div className="order-list__item-text">
              <div className="order-list__item-name">
                <span className="order-list__item-name-text">{entry.itemName}</span>
              </div>
              <div className="order-list__item-meta">{row.meta}</div>
            </div>
          </div>
        </td>
        {!isFlat && <td className="order-list__category-cell">{row.categoryLabel}</td>}
        <td className="order-list__num-cell order-list__stock-cell" data-label="Stock">
          <span className="order-list__cell-value">
            <span className="order-list__on-hand">{row.onHand ?? '—'}</span>
            <span className="order-list__par"> / {row.par ?? '—'}</span>
          </span>
        </td>
        <td className="order-list__num-cell order-list__need-cell" data-label="Need" style={{ color: row.needFg, fontWeight: 800 }}>
          <span className="order-list__cell-value">
            {entry.quantityNeeded} <span className="order-list__unit">{entry.unitOfMeasurement}</span>
          </span>
        </td>
        <td className="order-list__num-cell order-list__manual-cell" data-label="Manual">
          <span className="order-list__cell-value">
            {entry.manualAddition > 0 ? (
              <span className="order-list__manual-value">
                +{entry.manualAddition} <span className="order-list__unit">{entry.unitOfMeasurement}</span>
              </span>
            ) : (
              <span className="order-list__manual-empty">—</span>
            )}
          </span>
        </td>
        <td className="order-list__num-cell order-list__ordered-cell" data-label="Ordered">
          <span className="order-list__cell-value">{orderedCell(entry)}</span>
        </td>
        {isFlat && (
          <>
            <td className="order-list__mobile-hide">{entry.supplierName ?? '—'}</td>
            <td className="order-list__mobile-hide">{row.categoryLabel}</td>
          </>
        )}
        <td className={isFlat ? 'order-list__status-cell' : 'order-list__status-dropdown-cell'}>
          <StatusDotMenu
            options={row.statusOptions}
            value={entry.status}
            onChange={(value) => requestStatusChange(entry, value as OrderStatus)}
            ariaLabel={`Change status for ${entry.itemName}`}
          />
        </td>
      </tr>
    );
  }

  const storeSelect = (
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
  );

  return (
    <div className="super-admin-orders">

      <div className="order-dashboard-page__subtabs">
        <div className="order-dashboard-page__subtab-list">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`order-dashboard-page__subtab${subTab === tab.key ? ' order-dashboard-page__subtab--active' : ''}`}
              onClick={() => setSubTab(tab.key)}
              aria-label={tab.label}
            >
              <span className="order-dashboard-page__subtab-label-full" aria-hidden="true">{tab.label}</span>
              <span className="order-dashboard-page__subtab-label-short" aria-hidden="true">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
        {/* Always stays in this one slot, mobile included -- it used to move
            down to replace the eyebrow label once a store was picked, but
            that shifted the picker's position after selection, which is
            exactly what should not happen. The --mobile modifier (full
            width) keeps it sized the same whether or not a store is picked. */}
        <div className={`super-admin-orders__store-select${isMobile ? ' super-admin-orders__store-select--mobile' : ''}`}>
          {storeSelect}
        </div>
      </div>

      {selectedStoreId !== null && (
        <div className="super-admin-orders__store">
          {!isMobile && (
            <span className="super-admin-orders__eyebrow">{selectedStoreName}</span>
          )}

          {subTab === 'counts' && <SuperAdminInventoryCounts storeId={selectedStoreId} />}
          {subTab === 'eod-report' && <SuperAdminEodSupplierReport storeId={selectedStoreId} storeName={selectedStoreName} />}
          {subTab === 'purchasing-report' && <SuperAdminOrdersPurchaseReport storeId={selectedStoreId} />}

          {subTab === 'orders' && (
          <>
          <div className="stat-card-row">
            <StatCard icon={Layers} label="All Open" value={openCount} tone="primary" active={statusFilter === 'OPEN'} onClick={() => pickStatusTile('OPEN')} />
            <StatCard icon={PackageSearch} label="Needs Ordering" value={needsCount} tone="warning" active={statusFilter === 'NEEDS_ORDERING'} onClick={() => pickStatusTile('NEEDS_ORDERING')} />
            <StatCard icon={Truck} label="Ordered" value={orderedCount} tone="info" active={statusFilter === 'ORDERED'} onClick={() => pickStatusTile('ORDERED')} />
            <StatCard icon={PackageCheck} label="Received" value={receivedCount} tone="success" active={statusFilter === 'RECEIVED'} onClick={() => pickStatusTile('RECEIVED')} />
          </div>

          <div className="order-list__filter-row">
            <div className="order-list__filter-card">
              <SearchInput value={search} onChange={setSearch} placeholder="Search items" variant="surface" />
              <div className="order-list__filter-fields">
                <Select className="order-list__filter-select order-list__filter-select--category" options={[{ value: 'all', label: 'All categories' }, ...buildCategoryOptions([...categoryByItemId.values()], [categoryFilter === 'all' ? null : categoryFilter])]} value={categoryFilter} onChange={setCategoryFilter} ariaLabel="Category" />
                <Select className="order-list__filter-select order-list__filter-select--status" options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} ariaLabel="Status" />
                <Select className="order-list__filter-select order-list__filter-select--supplier" options={supplierFilterOptions} value={supplierFilter} onChange={setSupplierFilter} ariaLabel="Supplier" />
                <span className="order-list__row-break" aria-hidden="true" />
                <div
                  className={`order-list__clear-slot${hasActiveFilters ? '' : ' order-list__clear-slot--empty'}`}
                  style={hasActiveFilters ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
                >
                  <FilterClearButton onClick={clearFilters} />
                </div>
              </div>
            </div>
            <div role="group" aria-label="View" className="order-list__view-toggle order-list__view-toggle--spaced">
              <button type="button" aria-pressed={grouped} className={`order-list__view-btn${grouped ? ' order-list__view-btn--active' : ''}`} onClick={() => setGrouped(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                By supplier
              </button>
              <button type="button" aria-pressed={!grouped} className={`order-list__view-btn${!grouped ? ' order-list__view-btn--active' : ''}`} onClick={() => setGrouped(false)}>
                <List size={14} />
                List
              </button>
            </div>
            {isMobile && (
              <button type="button" className="order-list__action-btn order-list__action-btn--primary order-list__add-item-btn" onClick={() => { setAddError(null); setIsAddOpen(true); }}>
                <Plus size={16} />
                Add item
              </button>
            )}
          </div>

          {!isMobile && (
            <div className="order-list__action-bar">
              <div className="order-list__action-bar-select">
                <CheckboxButton checked={allChecked} indeterminate={someChecked && !allChecked} ariaLabel="Select all visible orders" onClick={toggleSelectAll} />
                <span className="order-list__select-label">{someChecked ? `${selectedIds.size} selected` : `${decorated.length} ${decorated.length === 1 ? 'order' : 'orders'}`}</span>
                {someChecked && (
                  <button type="button" className="order-list__clear-selection" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </button>
                )}
              </div>
              <div className="order-list__action-bar-spacer" />
              <button type="button" className="order-list__action-btn" disabled={!someChecked} onClick={() => requestBulkStatusChange([...selectedIds], 'ORDERED')}>
                <Truck size={16} />
                Mark ordered
              </button>
              <button type="button" className="order-list__action-btn" disabled={!someChecked} onClick={() => requestBulkStatusChange([...selectedIds], 'RECEIVED')}>
                <CircleCheck size={16} />
                Mark received
              </button>
              <button type="button" className="order-list__action-btn" disabled={!someChecked} onClick={handleCopySelected}>
                <Clipboard size={16} />
                Copy selected items
              </button>
              <button type="button" className="order-list__action-btn order-list__action-btn--primary" onClick={() => { setAddError(null); setIsAddOpen(true); }}>
                <Plus size={16} />
                Add item
              </button>
            </div>
          )}

          {/* Single sticky row, same as OrderList.tsx's own mobile selection
              bar (RTS-304 parity) -- the checkbox/count/clear are always
              shown, and the bulk actions appear alongside once something's
              selected, instead of a separate floating bar. */}
          {isMobile && !entriesLoading && decorated.length > 0 && (
            <div className="order-list__mobile-select-all">
              <div className="order-list__mobile-select-all-info">
                <CheckboxButton checked={allChecked} indeterminate={someChecked && !allChecked} ariaLabel="Select all visible orders" onClick={toggleSelectAll} />
                <span className="order-list__select-label">
                  {someChecked ? `${selectedIds.size} selected` : `Select all ${decorated.length} ${decorated.length === 1 ? 'order' : 'orders'}`}
                </span>
                {someChecked && <FilterClearButton onClick={() => setSelectedIds(new Set())} ariaLabel="Clear selection" />}
              </div>
              {someChecked && (
                <div className="order-list__mobile-select-all-actions">
                  <button type="button" className="order-list__action-btn order-list__action-btn--sm" onClick={() => requestBulkStatusChange([...selectedIds], 'ORDERED')}>
                    <Truck size={14} />
                    Ordered
                  </button>
                  <button type="button" className="order-list__action-btn order-list__action-btn--sm" onClick={() => requestBulkStatusChange([...selectedIds], 'RECEIVED')}>
                    <CircleCheck size={14} />
                    Received
                  </button>
                  <button type="button" className="order-list__action-btn order-list__action-btn--sm" aria-label="Copy selected items" onClick={handleCopySelected}>
                    <Clipboard size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {entriesError && (
            <div className="order-list__error">
              {entriesError}
              <button type="button" className="btn btn--secondary" onClick={loadEntries}>
                Retry
              </button>
            </div>
          )}

          {!entriesLoading && !entriesError && decorated.length === 0 && (
            <div className="order-list__no-results">
              <div className="order-list__no-results-title">No orders match these filters</div>
              <div className="order-list__no-results-sub">Try a different search, or clear the filters to see every open order.</div>
            </div>
          )}

          {entriesLoading && <div className="order-list__loading">Loading...</div>}

          {!entriesLoading && !entriesError && decorated.length > 0 && grouped && (
            <div className="order-list__groups">
              {groups.map((group) => (
                <section key={group.key} className="order-list__group">
                  {isMobile ? (
                    <div className="order-list__group-header order-list__group-header--mobile">
                      <CheckboxButton checked={group.checked} indeterminate={group.indeterminate} ariaLabel={`Select all items from ${group.name}`} onClick={() => setGroupSelected(group.items.map((r) => r.entry.id), !group.checked)} />
                      <div className="order-list__group-mobile-top">
                        <span className="order-list__group-name">{group.name}</span>
                        <span className="order-list__group-mobile-progress">{group.mobileProgress}</span>
                      </div>
                      <div className="order-list__group-mobile-bottom">
                        <div className="order-list__progress-track">
                          <div className="order-list__progress-fill" style={{ width: group.pct, background: group.barColor }} />
                        </div>
                        <span className="order-list__group-mobile-summary">{group.mobileSummary}</span>
                      </div>
                      <button type="button" className="order-list__group-chevron-btn" aria-expanded={group.isOpen} aria-label={group.isOpen ? `Collapse ${group.name}` : `Expand ${group.name}`} onClick={() => setGroupOpen((c) => ({ ...c, [group.key]: !group.isOpen }))}>
                        <ChevronDown size={18} className={group.isOpen ? 'order-list__group-chevron--mobile-open' : undefined} />
                      </button>
                    </div>
                  ) : (
                    <div className="order-list__group-header">
                      <button type="button" className="order-list__group-toggle" aria-expanded={group.isOpen} onClick={() => setGroupOpen((c) => ({ ...c, [group.key]: !group.isOpen }))}>
                        <ChevronDown size={18} className={group.isOpen ? undefined : 'order-list__group-chevron--collapsed'} />
                        <span className="order-list__group-title">
                          <span className="order-list__group-name">{group.name}</span>
                          <span className="order-list__group-summary">{group.summary}</span>
                        </span>
                      </button>
                      <div className="order-list__group-progress">
                        <div className="order-list__progress-track">
                          <div className="order-list__progress-fill" style={{ width: group.pct, background: group.barColor }} />
                        </div>
                        <span className="order-list__progress-label">{group.progress}</span>
                      </div>
                      <div className="order-list__group-actions">
                        <button type="button" className="order-list__action-btn order-list__action-btn--sm" onClick={() => copyText(buildOrderListText(group.items.map((r) => r.entry), selectedStoreName, new Date()), 'Nothing to copy.', `${group.name} list copied.`)}>
                          <Clipboard size={14} />
                          Copy
                        </button>
                        {group.canBulk && (
                          <button type="button" className="order-list__dark-btn" onClick={() => bulkSetStatus(group.items.filter((r) => r.entry.status === 'NEEDS_ORDERING').map((r) => r.entry.id), 'ORDERED')}>
                            Mark all ordered
                          </button>
                        )}
                        {group.allDone && (
                          <span className="order-list__all-ordered">
                            <CircleCheck size={14} />
                            All ordered
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {group.isOpen && (
                    <>
                      <div className="table-scroll">
                        <table className="order-list__group-table">
                          <colgroup>
                            <col className="order-list__col--checkbox" />
                            <col />
                            <col className="order-list__col--category" />
                            <col className="order-list__col--num" />
                            <col className="order-list__col--num" />
                            <col className="order-list__col--num" />
                            <col className="order-list__col--num" />
                            <col className="order-list__col--status" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className="order-list__checkbox-cell"><CheckboxButton checked={group.checked} indeterminate={group.indeterminate} ariaLabel={`Select all items from ${group.name}`} onClick={() => setGroupSelected(group.items.map((r) => r.entry.id), !group.checked)} /></th>
                              <th>Item</th>
                              <th className="order-list__category-cell">Category</th>
                              <th className="order-list__num-header">Stock</th>
                              <th className="order-list__num-header">Need</th>
                              <th className="order-list__num-header">Manual</th>
                              <th className="order-list__num-header">Ordered</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>{group.shown.map((row) => renderRow(row, 'grouped'))}</tbody>
                        </table>
                      </div>
                      {group.hasMore && (
                        <button type="button" className="order-list__more-btn" onClick={() => setGroupExpanded((c) => ({ ...c, [group.key]: !(groupExpanded[group.key] ?? false) }))}>
                          {group.moreLabel}
                        </button>
                      )}
                    </>
                  )}
                </section>
              ))}
            </div>
          )}

          {!entriesLoading && !entriesError && decorated.length > 0 && !grouped && (
            <div className="order-list__flat-card">
              <div className="table-scroll">
                <table className="order-list__flat-table">
                  <colgroup>
                    <col style={{ width: '3%' }} />
                    <col style={{ width: '27%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '18%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="order-list__checkbox-cell"><CheckboxButton checked={allChecked} indeterminate={someChecked && !allChecked} ariaLabel="Select all visible orders" onClick={toggleSelectAll} /></th>
                      <th>Item</th>
                      <th className="order-list__num-header">Stock</th>
                      <th className="order-list__num-header">Need</th>
                      <th className="order-list__num-header">Manual</th>
                      <th className="order-list__num-header">Ordered</th>
                      <th>Supplier</th>
                      <th>Category</th>
                      <th className="order-list__status-header">Status</th>
                    </tr>
                  </thead>
                  <tbody>{decorated.map((row) => renderRow(row, 'flat'))}</tbody>
                </table>
              </div>
            </div>
          )}

          <AddToOrderPanel
            isOpen={isAddOpen}
            storeName={selectedStoreName}
            inventoryItems={inventoryItems}
            activeNeedByItemId={activeNeedByItemId}
            errorMessage={addError}
            isSubmitting={isAddSubmitting}
            onClose={() => setIsAddOpen(false)}
            onSubmit={handleAddSubmit}
          />
          </>
          )}
        </div>
      )}

      {selectedStoreId === null && (
        <p className="super-admin-orders__hint">Select a store above to view and manage its order list.</p>
      )}

      {pendingStatusChange && (
        <ChangeOrderStatusModal
          itemName={pendingStatusChange.entry.itemName}
          supplierName={pendingStatusChange.entry.supplierName}
          category={categoryByItemId.get(pendingStatusChange.entry.storeInventoryItemId) ?? null}
          imageId={pendingStatusChange.entry.imageId}
          fromStatus={pendingStatusChange.entry.status}
          toStatus={pendingStatusChange.nextStatus}
          orderedQuantity={roundQty(pendingStatusChange.entry.quantityNeeded + pendingStatusChange.entry.manualAddition)}
          unitOfMeasurement={pendingStatusChange.entry.unitOfMeasurement}
          onConfirm={confirmPendingStatusChange}
          onCancel={() => setPendingStatusChange(null)}
        />
      )}

      {pendingBulkStatusChange && (
        <BulkChangeOrderStatusModal
          nextStatus={pendingBulkStatusChange.nextStatus}
          eligibleItems={bulkEligibleItems}
          skippedCount={bulkSkippedCount}
          onConfirm={confirmPendingBulkStatusChange}
          onCancel={() => setPendingBulkStatusChange(null)}
        />
      )}
      {conflictMessage && <OrderAlreadyUpdatedModal message={conflictMessage} onClose={() => setConflictMessage(null)} />}
    </div>
  );
}

export default SuperAdminOrders;
