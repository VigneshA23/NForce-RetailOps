import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, CircleCheck, Clipboard, Layers, List, PackageCheck, PackageSearch, Plus, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { ApiError } from '../api/client';
import { createOrderListEntry, getOrderList, updateOrderListEntry } from '../api/orderList';
import { getOwnerSuppliers } from '../api/suppliers';
import { getInventoryCounts, getStoreInventoryItems } from '../api/storeInventory';
import type { CreateOrderListEntryValues, OrderListEntry, OrderStatus } from '../types/orderList';
import type { Supplier } from '../types/supplier';
import type { InventoryItemCategory } from '../types/storeInventory';
import { buildOrderListText } from '../utils/orderListExport';
import { STATUS_META, STATUS_ORDER } from '../utils/orderListStatus';
import AddToOrderPanel, { type OrderableInventoryItem } from '../components/AddToOrderPanel';
import StatCard from '../components/StatCard';
import CategoryIcon, { CATEGORY_VISUAL, FALLBACK_CATEGORY_VISUAL } from '../components/CategoryIcon';
import CheckboxButton from '../components/CheckboxButton';
import StatusDotMenu from '../components/StatusDotMenu';
import ChangeOrderStatusModal from '../components/ChangeOrderStatusModal';
import BulkChangeOrderStatusModal, { type BulkStatusChangeItem } from '../components/BulkChangeOrderStatusModal';
import OrderAlreadyUpdatedModal from '../components/OrderAlreadyUpdatedModal';
import Select from '../components/Select';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import { useIsMobile } from '../hooks/useMediaQuery';
import { buildCategoryOptions, categoryLabel as categoryLabelOf } from '../types/storeInventory';
import './OrderList.css';

type StatusFilter = 'OPEN' | OrderStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'All open' },
  { value: 'NEEDS_ORDERING', label: 'Needs ordering' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
];

const GROUP_ROW_LIMIT = 5;
const MOBILE_GROUP_ROW_LIMIT = 3;
const UNASSIGNED_GROUP_LABEL = 'Unassigned Supplier';

interface OrderListProps {
  storeName?: string | null;
  // Set by the shell when arriving from the Home low-stock tile, to open this
  // tab already filtered. `id` is a nonce, not data -- see the effect below.
  seed?: { status: string; id: number };
}

function OrderList({ storeName, seed }: OrderListProps) {
  const [entries, setEntries] = useState<OrderListEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<OrderableInventoryItem[]>([]);
  const [stockByItemId, setStockByItemId] = useState<Map<number, { current: number | null; minimum: number | null }>>(new Map());
  const [categoryByItemId, setCategoryByItemId] = useState<Map<number, InventoryItemCategory | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // A status picked from the dropdown doesn't take effect immediately --
  // ChangeOrderStatusModal confirms it first, since one click on the wrong
  // option could otherwise mark an order received by accident.
  const [pendingStatusChange, setPendingStatusChange] = useState<{ entry: OrderListEntry; nextStatus: OrderStatus } | null>(null);

  // Same confirmation, for the selection-based "Mark ordered"/"Mark
  // received" action-bar buttons -- `ids` is the raw selection, which can mix
  // eligible and ineligible rows (BulkChangeOrderStatusModal below works out
  // which is which from the current `entries`).
  const [pendingBulkStatusChange, setPendingBulkStatusChange] = useState<{ ids: number[]; nextStatus: OrderStatus } | null>(null);

  // Set when a status change is rejected because someone else already updated
  // the entry (HTTP 409) -- drives OrderAlreadyUpdatedModal.
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const isMobile = useIsMobile();

  function load() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getOrderList(), getOwnerSuppliers(), getStoreInventoryItems(), getInventoryCounts({ size: 500 })])
      .then(([list, sups, items, counts]) => {
        setEntries(list);
        setSuppliers(sups);
        setInventoryItems(
          items
            .filter((item) => item.active)
            .map((item) => ({ id: item.id, name: item.name, unitOfMeasurement: item.unitOfMeasurement, preferredSupplierId: item.preferredSupplierId })),
        );
        setStockByItemId(new Map(counts.rows.map((row) => [row.itemId, { current: row.currentStock, minimum: row.minimum }])));
        setCategoryByItemId(new Map(items.map((item) => [item.id, item.category])));
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
    setStatusFilter(seed.status as StatusFilter);
  }, [seed]);

  function applyUpdatedEntry(updated: OrderListEntry) {
    setEntries((current) => {
      const index = current.findIndex((e) => e.id === updated.id);
      return index === -1 ? [...current, updated] : current.map((e) => (e.id === updated.id ? updated : e));
    });
  }

  async function handleAddSubmit(values: CreateOrderListEntryValues) {
    setAddError(null);
    setIsAddSubmitting(true);
    try {
      const created = await createOrderListEntry(values);
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

  async function changeStatus(entry: OrderListEntry, nextStatus: OrderStatus) {
    try {
      const updated = await updateOrderListEntry(entry.id, {
        quantityNeeded: String(entry.quantityNeeded),
        supplierId: entry.supplierId,
        note: entry.note ?? '',
        status: nextStatus,
        expectedStatus: entry.status,
      });
      applyUpdatedEntry(updated);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Someone else (e.g. Super Admin) already moved this entry. Tell the
        // user and pull the fresh list instead of leaving a stale row on screen.
        setConflictMessage((current) => current ?? error.message);
        getOrderList().then(setEntries).catch(() => {});
        return false;
      }
      nfToast.error(error instanceof Error ? error.message : 'Failed to update order status');
      return false;
    }
  }

  async function handleStatusChange(entry: OrderListEntry, nextStatus: OrderStatus) {
    const ok = await changeStatus(entry, nextStatus);
    if (ok) nfToast.success(`"${entry.itemName}" marked as ${STATUS_META[nextStatus].label.toLowerCase()}.`);
  }

  function requestStatusChange(entry: OrderListEntry, nextStatus: OrderStatus) {
    if (nextStatus === entry.status) return;
    setPendingStatusChange({ entry, nextStatus });
  }

  async function confirmPendingStatusChange() {
    if (!pendingStatusChange) return;
    await handleStatusChange(pendingStatusChange.entry, pendingStatusChange.nextStatus);
    setPendingStatusChange(null);
  }

  async function bulkSetStatus(ids: number[], nextStatus: OrderStatus) {
    const targets = entries.filter((e) => ids.includes(e.id));
    if (targets.length === 0) return;
    const results = await Promise.allSettled(targets.map((entry) => changeStatus(entry, nextStatus)));
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
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
    await copyText(buildOrderListText(selected, storeName, new Date()), 'No items selected.', 'Selected items copied to clipboard.');
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
      // Mobile's card shows category as its own pill below the stats box now,
      // so its sub-line is just who/when -- unlike desktop's row, which still
      // folds category into `meta`'s neighbor, `mobileMeta`, only when there's
      // no note.
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
        // Mobile's card header is one line shorter than desktop's, so it
        // shows this pair instead of summary/progress above -- "2/9 ordered"
        // and "7 to order" rather than "9 items · 7 to order" / "2 of 9
        // ordered".
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
  function orderedCell(entry: OrderListEntry) {
    if (entry.status === 'NEEDS_ORDERING') return <span className="order-list__manual-empty">—</span>;
    return (
      <>
        {entry.quantityNeeded + entry.manualAddition} <span className="order-list__unit">{entry.unitOfMeasurement}</span>
      </>
    );
  }

  // Mobile's card diverges too far from desktop's table now (a nested
  // stats box, category/status as colored pills instead of plain cells) for
  // one shared <td>-per-column markup to serve both via CSS reflow alone --
  // see the group header above for the same split (order-list__group-header
  // vs. order-list__group-header--mobile). The desktop grouped/flat tables
  // below are untouched; this is the only caller for the mobile branch.
  function renderMobileCard(row: ReturnType<typeof decorate>) {
    const { entry } = row;
    return (
      <tr key={entry.id} className="order-list__row" style={{ background: row.checked ? '#fff5f6' : undefined }}>
        <td className="order-list__mobile-card-td">
          <div className="order-list__mobile-card-header">
            <CheckboxButton checked={row.checked} ariaLabel={`Select ${entry.itemName}`} onClick={() => toggleSelected(entry.id)} />
            <CategoryIcon category={row.category} name={entry.itemName} size={44} imageId={entry.imageId} />
            <div className="order-list__item-text">
              <div className="order-list__item-name">
                <span className="order-list__item-name-text">{entry.itemName}</span>
                {entry.adHoc && <span className="order-list__manual-badge">Manual</span>}
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
                {entry.quantityNeeded}
                {entry.manualAddition > 0 && <span className="order-list__manual-value"> +{entry.manualAddition}</span>}{' '}
                <span className="order-list__unit">{entry.unitOfMeasurement}</span>
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
                {entry.adHoc && <span className="order-list__manual-badge">Manual</span>}
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
            {entry.quantityNeeded}
            {entry.manualAddition > 0 && <span className="order-list__manual-value"> +{entry.manualAddition}</span>}{' '}
            <span className="order-list__unit">{entry.unitOfMeasurement}</span>
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

  if (loadError) {
    return (
      <div className="order-list__error">
        {loadError}
        <button type="button" className="btn btn--secondary" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="order-list">
      <div className="stat-card-row">
        <StatCard icon={Layers} label="All Open" value={openCount} tone="primary" active={statusFilter === 'OPEN'} onClick={() => pickStatusTile('OPEN')} />
        <StatCard icon={PackageSearch} label="Needs Ordering" value={needsCount} tone="warning" active={statusFilter === 'NEEDS_ORDERING'} onClick={() => pickStatusTile('NEEDS_ORDERING')} />
        <StatCard icon={Truck} label="Ordered" value={orderedCount} tone="info" active={statusFilter === 'ORDERED'} onClick={() => pickStatusTile('ORDERED')} />
        <StatCard icon={PackageCheck} label="Received" value={receivedCount} tone="success" active={statusFilter === 'RECEIVED'} onClick={() => pickStatusTile('RECEIVED')} />
      </div>

      <div className="order-list__filter-row">
        {/* display:contents outside mobile -- dissolves into plain flex
            siblings of SearchInput/filter-fields so desktop/tablet keep
            their existing single-row layout untouched. At mobile it becomes
            a real white card (search + filters only; the toggle/Add item
            row below stays outside it, on the page background). */}
        <div className="order-list__filter-card">
          <SearchInput value={search} onChange={setSearch} placeholder="Search items" variant="surface" />
          <div className="order-list__filter-fields">
            <Select className="order-list__filter-select order-list__filter-select--category" options={[{ value: 'all', label: 'All categories' }, ...buildCategoryOptions([...categoryByItemId.values()], [categoryFilter === 'all' ? null : categoryFilter])]} value={categoryFilter} onChange={setCategoryFilter} ariaLabel="Category" />
            <Select className="order-list__filter-select order-list__filter-select--status" options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} ariaLabel="Status" />
            <Select className="order-list__filter-select order-list__filter-select--supplier" options={supplierFilterOptions} value={supplierFilter} onChange={setSupplierFilter} ariaLabel="Supplier" />
            {/* Mobile-only (display:none elsewhere): a zero-height, full-width
                flex item forces everything after it onto a fresh row
                regardless of the other items' actual widths -- see
                OrderList.css for why relying on widths/flex-basis math alone
                to trigger the wrap was unreliable. */}
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

      {/* Mobile has no equivalent of the desktop action bar's own checkbox --
          per-row and per-group checkboxes exist, but nothing to select every
          visible order in one tap. This is that control, always shown (not
          just once something's selected) since tapping it from a clean slate
          is the whole point. */}
      {isMobile && !isLoading && decorated.length > 0 && (
        <div className="order-list__mobile-select-all">
          <CheckboxButton checked={allChecked} indeterminate={someChecked && !allChecked} ariaLabel="Select all visible orders" onClick={toggleSelectAll} />
          <span className="order-list__select-label">
            {someChecked ? `${selectedIds.size} selected` : `Select all ${decorated.length} ${decorated.length === 1 ? 'order' : 'orders'}`}
          </span>
          {someChecked && (
            <button type="button" className="order-list__clear-selection" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          )}
        </div>
      )}

      {isMobile && someChecked && createPortal(
        // Portaled straight to <body> -- AppShell's page-transition wrapper sets
        // `will-change: transform`, which (per spec) makes IT the containing
        // block for any position:fixed descendant instead of the real
        // viewport. Left un-portaled, "fixed to the bottom of the screen"
        // actually meant "fixed to the bottom of that scrollable wrapper",
        // so the bar scrolled away with the list instead of floating.
        // StatusDotMenu's dropdown panel works around the same issue the
        // same way.
        <div className="order-list__mobile-selection-bar">
          <span className="order-list__mobile-selection-count">{selectedIds.size} selected</span>
          <div className="order-list__mobile-selection-actions">
            <button type="button" onClick={() => requestBulkStatusChange([...selectedIds], 'ORDERED')}>Ordered</button>
            <button type="button" onClick={() => requestBulkStatusChange([...selectedIds], 'RECEIVED')}>Received</button>
            <button
              type="button"
              className="order-list__mobile-selection-copy"
              aria-label="Copy selected items"
              onClick={handleCopySelected}
            >
              <Clipboard size={16} />
            </button>
          </div>
        </div>,
        document.body,
      )}

      {!isLoading && decorated.length === 0 && (
        <div className="order-list__no-results">
          <div className="order-list__no-results-title">No orders match these filters</div>
          <div className="order-list__no-results-sub">Try a different search, or clear the filters to see every open order.</div>
        </div>
      )}

      {isLoading && <div className="order-list__loading">Loading...</div>}

      {!isLoading && decorated.length > 0 && grouped && (
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
                    <button type="button" className="order-list__action-btn order-list__action-btn--sm" onClick={() => copyText(buildOrderListText(group.items.map((r) => r.entry), storeName, new Date()), 'Nothing to copy.', `${group.name} list copied.`)}>
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
                        <col className="order-list__col--status" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="order-list__checkbox-cell"><CheckboxButton checked={group.checked} indeterminate={group.indeterminate} ariaLabel={`Select all items from ${group.name}`} onClick={() => setGroupSelected(group.items.map((r) => r.entry.id), !group.checked)} /></th>
                          <th>Item</th>
                          <th className="order-list__category-cell">Category</th>
                          <th className="order-list__num-header">Stock</th>
                          <th className="order-list__num-header">Need</th>
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

      {!isLoading && decorated.length > 0 && !grouped && (
        <div className="order-list__flat-card">
          <div className="table-scroll">
            <table className="order-list__flat-table">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '32%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="order-list__checkbox-cell"><CheckboxButton checked={allChecked} indeterminate={someChecked && !allChecked} ariaLabel="Select all visible orders" onClick={toggleSelectAll} /></th>
                  <th>Item</th>
                  <th className="order-list__num-header">Stock</th>
                  <th className="order-list__num-header">Need</th>
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
        storeName={storeName}
        inventoryItems={inventoryItems}
        activeNeedByItemId={activeNeedByItemId}
        errorMessage={addError}
        isSubmitting={isAddSubmitting}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleAddSubmit}
      />

      {pendingStatusChange && (
        <ChangeOrderStatusModal
          itemName={pendingStatusChange.entry.itemName}
          supplierName={pendingStatusChange.entry.supplierName}
          category={categoryByItemId.get(pendingStatusChange.entry.storeInventoryItemId) ?? null}
          imageId={pendingStatusChange.entry.imageId}
          fromStatus={pendingStatusChange.entry.status}
          toStatus={pendingStatusChange.nextStatus}
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

export default OrderList;
