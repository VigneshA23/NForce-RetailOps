import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, CircleCheck, Clipboard, Layers, List, PackageCheck, PackageSearch, Pencil, Plus, Truck } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { createOrderListEntry, getOrderList, updateOrderListEntry } from '../api/orderList';
import { getOwnerSuppliers } from '../api/suppliers';
import { getInventoryCounts, getStoreInventoryItems } from '../api/storeInventory';
import type { CreateOrderListEntryValues, OrderListEntry, OrderStatus, UpdateOrderListEntryValues } from '../types/orderList';
import type { Supplier } from '../types/supplier';
import type { InventoryItemCategory } from '../types/storeInventory';
import { buildOrderListText } from '../utils/orderListExport';
import OrderListEntryEditModal from '../components/OrderListEntryEditModal';
import AddToOrderPanel, { type OrderableInventoryItem } from '../components/AddToOrderPanel';
import StatCard from '../components/StatCard';
import CategoryIcon from '../components/CategoryIcon';
import CheckboxButton from '../components/CheckboxButton';
import StatusDotMenu from '../components/StatusDotMenu';
import Select from '../components/Select';
import SearchInput from '../components/SearchInput';
import FilterClearButton from '../components/FilterClearButton';
import { useIsMobile } from '../hooks/useMediaQuery';
import { INVENTORY_ITEM_CATEGORY_OPTIONS } from '../types/storeInventory';
import './OrderList.css';

const STATUS_META: Record<OrderStatus, { label: string; fg: string; bg: string }> = {
  NEEDS_ORDERING: { label: 'Needs ordering', fg: '#b3162a', bg: '#fde8ea' },
  ORDERED: { label: 'Ordered', fg: '#1d5fb8', bg: '#e5f1fd' },
  RECEIVED: { label: 'Received', fg: '#137a47', bg: '#e1f8ec' },
};
const STATUS_ORDER: OrderStatus[] = ['NEEDS_ORDERING', 'ORDERED', 'RECEIVED'];

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

  const [editTarget, setEditTarget] = useState<OrderListEntry | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);

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

  async function handleEditSubmit(values: UpdateOrderListEntryValues) {
    if (!editTarget) return;
    setEditError(null);
    setIsEditSubmitting(true);
    try {
      const updated = await updateOrderListEntry(editTarget.id, values);
      applyUpdatedEntry(updated);
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
      });
      applyUpdatedEntry(updated);
      return true;
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to update order status');
      return false;
    }
  }

  async function handleStatusChange(entry: OrderListEntry, nextStatus: OrderStatus) {
    const ok = await changeStatus(entry, nextStatus);
    if (ok) nfToast.success(`"${entry.itemName}" marked as ${STATUS_META[nextStatus].label.toLowerCase()}.`);
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
    const categoryLabel = INVENTORY_ITEM_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? '—';
    const raisedBy = entry.raisedByName ?? (entry.adHoc ? 'Manual' : 'Auto-detected');
    return {
      entry,
      category,
      categoryLabel,
      onHand: stock?.current ?? null,
      par: stock?.minimum ?? null,
      needFg: entry.status === 'NEEDS_ORDERING' ? '#b3162a' : '#18181b',
      meta: entry.note ? `${raisedBy} · ${entry.note}` : raisedBy,
      // Mobile's item card shows a different sub-line than desktop's table
      // (category + who + when, instead of who [+ note]) -- a separate field
      // rather than changing `meta` itself, so desktop's row is untouched.
      mobileMeta: `${categoryLabel} · ${raisedBy} · ${new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`,
      noteShown: entry.note || '—',
      sourceLabel: entry.adHoc ? 'Manual' : 'Count',
      statusLabel: meta.label,
      statusDot: meta.fg,
      checked: selectedIds.has(entry.id),
      statusOptions: STATUS_ORDER.map((key) => ({ value: key, label: STATUS_META[key].label, dot: STATUS_META[key].fg })),
    };
  }

  const decorated = useMemo(() => filteredEntries.map(decorate), [filteredEntries, stockByItemId, selectedIds]);

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

  function renderRow(row: ReturnType<typeof decorate>, variant: 'grouped' | 'flat') {
    const { entry } = row;
    const isFlat = variant === 'flat';
    return (
      <tr key={entry.id} className="order-list__row" style={{ background: row.checked ? '#fff5f6' : undefined }}>
        <td className="order-list__checkbox-cell">
          <CheckboxButton checked={row.checked} ariaLabel={`Select ${entry.itemName}`} onClick={() => toggleSelected(entry.id)} />
        </td>
        <td className="order-list__item-td">
          <div className="order-list__item-cell">
            <CategoryIcon category={row.category} name={entry.itemName} size={isMobile ? 44 : isFlat ? 36 : 40} imageId={entry.imageId} />
            <div className="order-list__item-text">
              <div className="order-list__item-name">
                <span className="order-list__item-name-text">{entry.itemName}</span>
                {entry.adHoc && <span className="order-list__manual-badge">Manual</span>}
              </div>
              <div className="order-list__item-meta">{row.meta}</div>
              <div className="order-list__item-mobile-meta">{row.mobileMeta}</div>
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
        {isFlat && (
          <>
            <td className="order-list__mobile-hide">{entry.supplierName ?? '—'}</td>
            <td className="order-list__mobile-hide">{row.categoryLabel}</td>
            <td className="order-list__mobile-hide">{row.sourceLabel}</td>
            <td className="order-list__note-cell order-list__mobile-hide">{row.noteShown}</td>
          </>
        )}
        {isFlat ? (
          <td className="order-list__status-cell">
            <div className="order-list__status-actions">
              <button
                type="button"
                className="order-list__edit-btn"
                aria-label={`Edit ${entry.itemName}`}
                title="Edit quantity, supplier or note"
                onClick={() => { setEditError(null); setEditTarget(entry); }}
              >
                <Pencil size={14} />
              </button>
              <StatusDotMenu
                options={row.statusOptions}
                value={entry.status}
                onChange={(value) => handleStatusChange(entry, value as OrderStatus)}
                ariaLabel={`Change status for ${entry.itemName}`}
              />
            </div>
          </td>
        ) : (
          <>
            <td className="order-list__status-dropdown-cell">
              <StatusDotMenu
                options={row.statusOptions}
                value={entry.status}
                onChange={(value) => handleStatusChange(entry, value as OrderStatus)}
                ariaLabel={`Change status for ${entry.itemName}`}
              />
            </td>
            <td className="order-list__actions-cell">
              <button
                type="button"
                className="order-list__edit-btn"
                aria-label={`Edit ${entry.itemName}`}
                title="Edit quantity, supplier or note"
                onClick={() => { setEditError(null); setEditTarget(entry); }}
              >
                <Pencil size={14} />
              </button>
            </td>
          </>
        )}
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search items" variant="surface" />
        <div className="order-list__filter-group">
          <Select className="order-list__filter-select order-list__filter-select--category" options={[{ value: 'all', label: 'All categories' }, ...INVENTORY_ITEM_CATEGORY_OPTIONS]} value={categoryFilter} onChange={setCategoryFilter} ariaLabel="Category" />
          <Select className="order-list__filter-select order-list__filter-select--status" options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} ariaLabel="Status" />
          <Select className="order-list__filter-select order-list__filter-select--supplier" options={supplierFilterOptions} value={supplierFilter} onChange={setSupplierFilter} ariaLabel="Supplier" />
          {/* Mobile-only (display:none elsewhere): a zero-height, full-width flex
              item forces everything after it onto a fresh row regardless of the
              other items' actual widths -- see OrderList.css for why relying on
              widths/flex-basis math alone to trigger the wrap was unreliable. */}
          <span className="order-list__row-break" aria-hidden="true" />
          <div
            className={`order-list__clear-slot${hasActiveFilters ? '' : ' order-list__clear-slot--empty'}`}
            style={hasActiveFilters ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
          >
            <FilterClearButton onClick={clearFilters} />
          </div>
          <span className="order-list__row-break" aria-hidden="true" />
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
          <button type="button" className="order-list__action-btn" disabled={!someChecked} onClick={() => bulkSetStatus([...selectedIds], 'ORDERED')}>
            <Truck size={16} />
            Mark ordered
          </button>
          <button type="button" className="order-list__action-btn" disabled={!someChecked} onClick={() => bulkSetStatus([...selectedIds], 'RECEIVED')}>
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
            <button type="button" onClick={() => bulkSetStatus([...selectedIds], 'ORDERED')}>Ordered</button>
            <button type="button" onClick={() => bulkSetStatus([...selectedIds], 'RECEIVED')}>Received</button>
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
                  <div className="order-list__group-mobile-row">
                    <CheckboxButton checked={group.checked} indeterminate={group.indeterminate} ariaLabel={`Select all items from ${group.name}`} onClick={() => setGroupSelected(group.items.map((r) => r.entry.id), !group.checked)} />
                    <span className="order-list__group-name">{group.name}</span>
                    <button type="button" className="order-list__group-chevron-btn" aria-expanded={group.isOpen} aria-label={group.isOpen ? `Collapse ${group.name}` : `Expand ${group.name}`} onClick={() => setGroupOpen((c) => ({ ...c, [group.key]: !group.isOpen }))}>
                      <ChevronDown size={18} className={group.isOpen ? undefined : 'order-list__group-chevron--collapsed'} />
                    </button>
                  </div>
                  <div className="order-list__group-progress-block">
                    <span className="order-list__group-mobile-progress">{group.mobileProgress}</span>
                    <div className="order-list__progress-track">
                      <div className="order-list__progress-fill" style={{ width: group.pct, background: group.barColor }} />
                    </div>
                    <span className="order-list__group-mobile-summary">{group.mobileSummary}</span>
                  </div>
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
                        <col className="order-list__col--status" />
                        <col className="order-list__col--actions" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="order-list__checkbox-cell"><CheckboxButton checked={group.checked} indeterminate={group.indeterminate} ariaLabel={`Select all items from ${group.name}`} onClick={() => setGroupSelected(group.items.map((r) => r.entry.id), !group.checked)} /></th>
                          <th>Item</th>
                          <th className="order-list__category-cell">Category</th>
                          <th className="order-list__num-header">Stock</th>
                          <th className="order-list__num-header">Need</th>
                          <th>Status</th>
                          <th className="order-list__actions-cell" aria-hidden="true" />
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
                <col style={{ width: '25%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="order-list__checkbox-cell"><CheckboxButton checked={allChecked} indeterminate={someChecked && !allChecked} ariaLabel="Select all visible orders" onClick={toggleSelectAll} /></th>
                  <th>Item</th>
                  <th className="order-list__num-header">Stock</th>
                  <th className="order-list__num-header">Need</th>
                  <th>Supplier</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Note</th>
                  <th className="order-list__status-header">Status</th>
                </tr>
              </thead>
              <tbody>{decorated.map((row) => renderRow(row, 'flat'))}</tbody>
            </table>
          </div>
        </div>
      )}

      <OrderListEntryEditModal
        isOpen={editTarget !== null}
        entry={editTarget}
        suppliers={suppliers}
        errorMessage={editError}
        isSubmitting={isEditSubmitting}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />

      <AddToOrderPanel
        isOpen={isAddOpen}
        storeName={storeName}
        inventoryItems={inventoryItems}
        suppliers={suppliers}
        errorMessage={addError}
        isSubmitting={isAddSubmitting}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleAddSubmit}
      />
    </div>
  );
}

export default OrderList;
