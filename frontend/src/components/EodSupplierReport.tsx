import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clipboard, List } from 'lucide-react';
import CalendarPopover from './CalendarPopover';
import CategoryIcon from './CategoryIcon';
import Select from './Select';
import SearchInput from './SearchInput';
import FilterClearButton from './FilterClearButton';
import { getEodSupplierReport } from '../api/storeInventory';
import type { EodReportRow, EodReportStatus, EodSupplierReport as EodSupplierReportData } from '../types/stockCheck';
import { buildCategoryOptions, categoryLabel as categoryLabelOf } from '../types/storeInventory';
import { useIsMobile } from '../hooks/useMediaQuery';
import { formatDateNavLabel, stepDate, todayDate } from '../utils/checklistHistoryOptions';
import { buildEodReportText, usableStock } from '../utils/orderListExport';
import { nfToast } from '../utils/toast';
import '../pages/OrderList.css';
import './EodSupplierReport.css';

const STATUS_META: Record<EodReportStatus, { label: string; tone: string }> = {
  NEEDS_TO_ORDER: { label: 'Needs to Order', tone: 'danger' },
  SUFFICIENT: { label: 'Sufficient', tone: 'success' },
  END_OF_DAY_PENDING: { label: 'EOD Pending', tone: 'warning' },
  NO_MINIMUM_SET: { label: 'No Minimum Set', tone: 'info' },
};

const STATUS_FILTER_OPTIONS: { value: 'all' | EodReportStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'NEEDS_TO_ORDER', label: 'Needs to Order' },
  { value: 'SUFFICIENT', label: 'Sufficient' },
  { value: 'END_OF_DAY_PENDING', label: 'EOD Pending' },
  { value: 'NO_MINIMUM_SET', label: 'No Minimum Set' },
];

const GROUP_ROW_LIMIT = 5;
const MOBILE_GROUP_ROW_LIMIT = 3;

function value(n: number | null): string {
  return n == null ? '—' : String(n);
}

async function copyText(text: string, emptyMessage: string, successMessage: string) {
  if (!text) {
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

interface DecoratedRow {
  item: EodReportRow;
  supplierId: number | null;
  supplierName: string;
  categoryLabel: string;
  startUsable: number | null;
  endUsable: number | null;
  // Start and End of Day dead stock merged into one figure: the End of Day
  // count supersedes Start of Day's once it's been taken (same day, later
  // and more current), rather than showing both as separate columns.
  deadStock: number | null;
  statusLabel: string;
  statusTone: string;
}

// Owner/Admin's End of Day supplier report: same supplier-grouped card UI and
// By supplier/List toggle as OrderList.tsx (RTS-304 parity), reusing its
// `order-list__*` classes directly rather than a parallel copy, but with
// EOD's own columns (Start/End of Day usable + dead stock, usage, tomorrow's
// requirement, quantity to order, status) in place of Order List's own. No
// checkboxes or bulk actions -- EOD status isn't something you mark in bulk
// the way an order's status is.
function EodSupplierReport({ storeName }: { storeName?: string | null }) {
  const isMobile = useIsMobile();
  const [date, setDate] = useState(todayDate());
  const [report, setReport] = useState<EodSupplierReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | EodReportStatus>('all');
  const [grouped, setGrouped] = useState(true);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getEodSupplierReport(date)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const isToday = date >= todayDate();
  const hasItems = (report?.groups.length ?? 0) > 0;

  async function handleCopy() {
    if (!report) return;
    await copyText(buildEodReportText(report, storeName), 'No inventory items to report for this day.', 'Report copied to clipboard.');
  }

  function decorate(item: EodReportRow, supplierId: number | null, supplierName: string): DecoratedRow {
    const status = STATUS_META[item.status];
    return {
      item,
      supplierId,
      supplierName,
      categoryLabel: categoryLabelOf(item.category) || '—',
      startUsable: usableStock(item.startOfDayAvailable, item.startOfDayDeadStock),
      endUsable: usableStock(item.endOfDayAvailable, item.endOfDayDeadStock),
      deadStock: item.endOfDayDeadStock ?? item.startOfDayDeadStock,
      statusLabel: status.label,
      statusTone: status.tone,
    };
  }

  const allRows = useMemo(
    () => (report?.groups ?? []).flatMap((g) => g.items.map((item) => decorate(item, g.supplierId, g.supplierName))),
    [report],
  );

  const categoryFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...buildCategoryOptions(allRows.map((r) => r.item.category))],
    [allRows],
  );

  // Built from the report's own groups (already fetched), not a separate
  // suppliers API call -- same set of suppliers the grouped view's own cards
  // use, so the two can't drift apart.
  const supplierFilterOptions = useMemo(() => {
    const named = (report?.groups ?? [])
      .filter((g) => g.supplierId != null)
      .map((g) => ({ value: String(g.supplierId), label: g.supplierName }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    const hasUnassigned = (report?.groups ?? []).some((g) => g.supplierId == null);
    return [
      { value: 'all', label: 'All suppliers' },
      ...named,
      ...(hasUnassigned ? [{ value: 'UNASSIGNED', label: 'No Supplier' }] : []),
    ];
  }, [report]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (normalizedSearch && !row.item.itemName.toLowerCase().includes(normalizedSearch)) return false;
      if (categoryFilter !== 'all' && row.item.category !== categoryFilter) return false;
      if (supplierFilter === 'UNASSIGNED' && row.supplierId != null) return false;
      if (supplierFilter !== 'all' && supplierFilter !== 'UNASSIGNED' && String(row.supplierId) !== supplierFilter) return false;
      if (statusFilter !== 'all' && row.item.status !== statusFilter) return false;
      return true;
    });
  }, [allRows, search, categoryFilter, supplierFilter, statusFilter]);

  const hasActiveFilters = search !== '' || categoryFilter !== 'all' || supplierFilter !== 'all' || statusFilter !== 'all';
  function clearFilters() {
    setSearch('');
    setCategoryFilter('all');
    setSupplierFilter('all');
    setStatusFilter('all');
  }

  const groups = useMemo(() => {
    const bySupplier = new Map<string, { key: string; name: string; supplierId: number | null; items: DecoratedRow[] }>();
    for (const row of filteredRows) {
      const key = String(row.supplierId ?? 'none');
      const bucket = bySupplier.get(key) ?? { key, name: row.supplierName, supplierId: row.supplierId, items: [] };
      bucket.items.push(row);
      bySupplier.set(key, bucket);
    }
    // Preserve the API's own group order (named suppliers first, "No
    // Supplier" last) rather than re-sorting -- it's already in that order.
    const orderedKeys = (report?.groups ?? []).map((g) => String(g.supplierId ?? 'none'));
    const rowLimit = isMobile ? MOBILE_GROUP_ROW_LIMIT : GROUP_ROW_LIMIT;
    return orderedKeys
      .map((key) => bySupplier.get(key))
      .filter((g): g is NonNullable<typeof g> => g != null && g.items.length > 0)
      .map((group) => {
        const needs = group.items.filter((row) => row.item.status === 'NEEDS_TO_ORDER');
        const done = group.items.length - needs.length;
        const isOpen = groupOpen[group.key] ?? needs.length > 0;
        const isExpanded = groupExpanded[group.key] ?? false;
        return {
          ...group,
          needsCount: needs.length,
          isOpen,
          shown: isExpanded ? group.items : group.items.slice(0, rowLimit),
          hasMore: group.items.length > rowLimit,
          moreLabel: isExpanded ? 'Show less' : `Show all ${group.items.length} items`,
          summary: `${group.items.length} item${group.items.length === 1 ? '' : 's'} · ${needs.length ? `${needs.length} to order` : 'nothing to order'}`,
          progress: `${done} of ${group.items.length} OK`,
          mobileProgress: `${done}/${group.items.length} OK`,
          mobileSummary: needs.length ? `${needs.length} to order` : 'Nothing to order',
          pct: `${Math.round((done / group.items.length) * 100)}%`,
          barColor: needs.length ? '#1d5fb8' : '#16a34a',
        };
      });
  }, [filteredRows, report, groupOpen, groupExpanded, isMobile]);

  function copyGroup(group: { name: string; supplierId: number | null; items: DecoratedRow[] }) {
    if (!report) return;
    const synthetic: EodSupplierReportData = {
      date: report.date,
      itemsNeedingOrder: 0,
      itemsPendingEndOfDay: 0,
      groups: [{ supplierId: group.supplierId, supplierName: group.name, items: group.items.map((r) => r.item) }],
    };
    copyText(buildEodReportText(synthetic, storeName), 'Nothing to copy.', `${group.name} list copied.`);
  }

  function renderStatusBadge(row: DecoratedRow) {
    return <span className={`badge badge--${row.statusTone}`}>{row.statusLabel}</span>;
  }

  function renderMobileCard(row: DecoratedRow) {
    const { item } = row;
    return (
      <tr key={item.storeInventoryItemId} className="order-list__row">
        <td className="order-list__mobile-card-td">
          <div className="order-list__mobile-card-header">
            <CategoryIcon category={item.category} name={item.itemName} size={44} imageId={item.imageId} />
            <div className="order-list__item-text">
              <div className="order-list__item-name">
                <span className="order-list__item-name-text">{item.itemName}</span>
              </div>
              <div className="order-list__item-mobile-meta">{row.supplierName}</div>
            </div>
          </div>
          <div className="order-list__mobile-stats">
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Start</span>
              <span className="order-list__cell-value">{value(row.startUsable)}</span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">End</span>
              <span className="order-list__cell-value">{value(row.endUsable)}</span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Dead</span>
              <span className={row.deadStock ? 'eod-report__dead' : 'order-list__cell-value'}>{value(row.deadStock)}</span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Used</span>
              <span className="order-list__cell-value">{value(item.stockUsed)}</span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Req. Tomorrow</span>
              <span className="order-list__cell-value">{value(item.requiredTomorrow)}</span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Order Qty</span>
              <span className="order-list__cell-value">
                <strong className={item.quantityToOrder ? 'eod-report__order-qty' : undefined}>{value(item.quantityToOrder)}</strong>
                <span className="eod-report__unit">{item.unitOfMeasurement}</span>
              </span>
            </div>
            <div className="order-list__mobile-stat">
              <span className="order-list__mobile-stat-label">Ordered</span>
              <span className="order-list__cell-value">
                {item.orderedQuantity != null ? (
                  <strong className="eod-report__order-qty">{item.orderedQuantity}</strong>
                ) : (
                  value(null)
                )}
              </span>
            </div>
          </div>
          <div className="order-list__mobile-footer">
            <span className="order-list__mobile-pill" style={{ background: '#f4f4f5', color: '#52525b' }}>
              {row.categoryLabel}
            </span>
            {renderStatusBadge(row)}
          </div>
        </td>
      </tr>
    );
  }

  function renderRow(row: DecoratedRow, variant: 'grouped' | 'flat') {
    const { item } = row;
    const isFlat = variant === 'flat';
    if (isMobile) return renderMobileCard(row);
    return (
      <tr key={item.storeInventoryItemId} className="order-list__row">
        <td className="order-list__item-td">
          <div className="order-list__item-cell">
            <CategoryIcon category={item.category} name={item.itemName} size={isFlat ? 48 : 56} imageId={item.imageId} />
            <div className="order-list__item-text">
              <div className="order-list__item-name">
                <span className="order-list__item-name-text">{item.itemName}</span>
                <span className="eod-report__unit">{item.unitOfMeasurement}</span>
              </div>
            </div>
          </div>
        </td>
        {!isFlat && <td className="order-list__category-cell">{row.categoryLabel}</td>}
        <td className="order-list__num-cell" data-label="Start Usable">
          <span className="order-list__cell-value">{value(row.startUsable)}</span>
        </td>
        <td className="order-list__num-cell" data-label="Dead">
          <span className={row.deadStock ? 'eod-report__dead' : undefined}>{value(row.deadStock)}</span>
        </td>
        <td className="order-list__num-cell" data-label="End Usable">
          <span className="order-list__cell-value">{value(row.endUsable)}</span>
        </td>
        <td className="order-list__num-cell" data-label="Used">
          <span className="order-list__cell-value">{value(item.stockUsed)}</span>
        </td>
        <td className="order-list__num-cell" data-label="Required Tomorrow">
          <span className="order-list__cell-value">{value(item.requiredTomorrow)}</span>
        </td>
        <td className="order-list__num-cell" data-label="Order Qty">
          <strong className={item.quantityToOrder ? 'eod-report__order-qty' : undefined}>{value(item.quantityToOrder)}</strong>
        </td>
        <td className="order-list__num-cell" data-label="Ordered">
          <strong className={item.orderedQuantity != null ? 'eod-report__order-qty' : undefined}>{value(item.orderedQuantity)}</strong>
        </td>
        {isFlat && <td className="order-list__mobile-hide">{row.supplierName}</td>}
        <td className="order-list__status-cell">{renderStatusBadge(row)}</td>
      </tr>
    );
  }

  return (
    <div className="order-list eod-report">
      <div className="eod-report__toolbar">
        <div className="eod-report__date-nav">
          <button type="button" className="eod-report__date-arrow" onClick={() => setDate(stepDate(date, -1))} aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          <button
            ref={dateTriggerRef}
            type="button"
            className="eod-report__date-display"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label="Pick a date"
          >
            <Calendar size={13} />
            {formatDateNavLabel(date)}
          </button>
          <button
            type="button"
            className="eod-report__date-arrow"
            onClick={() => setDate(stepDate(date, 1))}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {report && !isLoading && (
          <p className="eod-report__summary">
            {report.itemsNeedingOrder} to order · {report.itemsPendingEndOfDay} awaiting End of Day count
          </p>
        )}
        <button type="button" className="btn btn--secondary" onClick={handleCopy} disabled={isLoading || !hasItems}>
          <Clipboard size={16} />
          Copy Report
        </button>
      </div>
      <CalendarPopover
        value={date}
        max={todayDate()}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(d) => setDate(d)}
        anchorRef={dateTriggerRef}
      />

      {loadError && <div className="eod-report__error">{loadError}</div>}

      {!loadError && (
        <>
          <div className="order-list__filter-row">
            <div className="order-list__filter-card">
              <SearchInput value={search} onChange={setSearch} placeholder="Search items" variant="surface" />
              <div className="order-list__filter-fields">
                <Select className="order-list__filter-select order-list__filter-select--category" options={categoryFilterOptions} value={categoryFilter} onChange={setCategoryFilter} ariaLabel="Category" />
                <Select className="order-list__filter-select order-list__filter-select--status" options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(v) => setStatusFilter(v as 'all' | EodReportStatus)} ariaLabel="Status" />
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
          </div>

          {!isLoading && filteredRows.length === 0 && (
            <div className="order-list__no-results">
              <div className="order-list__no-results-title">No items match these filters</div>
              <div className="order-list__no-results-sub">Try a different search, or clear the filters to see every item.</div>
            </div>
          )}

          {isLoading && <div className="order-list__loading">Loading...</div>}

          {!isLoading && filteredRows.length > 0 && grouped && (
            <div className="order-list__groups">
              {groups.map((group) => (
                <section key={group.key} className="order-list__group">
                  {isMobile ? (
                    <div className="order-list__group-header order-list__group-header--mobile">
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
                        <button type="button" className="order-list__action-btn order-list__action-btn--sm" onClick={() => copyGroup(group)}>
                          <Clipboard size={14} />
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                  {group.isOpen && (
                    <>
                      <div className="table-scroll">
                        <table className="order-list__group-table">
                          {/* Explicit percentages, not the shared .order-list__col--num
                              (10% each, tuned for Order List's 4 numeric columns) --
                              this table has 7, which at 10% apiece would squeeze
                              Item/Category down to nothing. */}
                          <colgroup>
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '14%' }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th className="order-list__category-cell">Category</th>
                              <th className="order-list__num-header">Start Usable</th>
                              <th className="order-list__num-header">Dead</th>
                              <th className="order-list__num-header">End Usable</th>
                              <th className="order-list__num-header">Used</th>
                              <th className="order-list__num-header">Required Tomorrow</th>
                              <th className="order-list__num-header">Order Qty</th>
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

          {!isLoading && filteredRows.length > 0 && !grouped && (
            <div className="order-list__flat-card">
              <div className="table-scroll">
                <table className="order-list__flat-table">
                  <colgroup>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="order-list__num-header">Start Usable</th>
                      <th className="order-list__num-header">Dead</th>
                      <th className="order-list__num-header">End Usable</th>
                      <th className="order-list__num-header">Used</th>
                      <th className="order-list__num-header">Required Tomorrow</th>
                      <th className="order-list__num-header">Order Qty</th>
                      <th className="order-list__num-header">Ordered</th>
                      <th>Supplier</th>
                      <th className="order-list__status-header">Status</th>
                    </tr>
                  </thead>
                  <tbody>{filteredRows.map((row) => renderRow(row, 'flat'))}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EodSupplierReport;
