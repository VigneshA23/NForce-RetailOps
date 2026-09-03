import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { getStores } from '../api/ownerStores';
import { ChecklistHistoryRangeError, getChecklistHistoryDetail, getChecklistHistorySummary } from '../api/checklistHistory';
import type { OwnerStore } from '../types/ownerStore';
import type { ChecklistHistoryDetail, ChecklistHistorySummaryRow } from '../types/checklistHistory';
import StoreDetailTable, { type StoreDetailRow } from '../components/StoreDetailTable';
import { formatDateLabel, taskStatus, todayDate } from '../utils/checklistHistoryOptions';
import './StoreDetail.css';

type FilterKey = 'ALL' | 'COMPLETE' | 'OPEN' | 'ISSUE';

interface StoreDetailProps {
  // Set when navigated to from another page (e.g. Home's "Details" link) to
  // preselect a specific store instead of defaulting to the first one.
  initialStoreId?: number | null;
}

function StoreDetail({ initialStoreId = null }: StoreDetailProps) {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(initialStoreId);
  const [date, setDate] = useState(todayDate);

  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('ALL');

  // Daily Operations Summary report -- independent of the Daily Checklist's
  // own store/date fields above, since it aggregates a date RANGE (optionally
  // across every store), not one store on one day.
  const [reportStartDate, setReportStartDate] = useState(todayDate);
  const [reportEndDate, setReportEndDate] = useState(todayDate);
  const [reportAllStores, setReportAllStores] = useState(true);
  const [reportRows, setReportRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  function loadStores() {
    setStoresLoading(true);
    setStoresError(null);
    getStores()
      .then((result) => {
        setStores(result);
        setSelectedStoreId((current) => current ?? result[0]?.id ?? null);
      })
      .catch((error: Error) => setStoresError(error.message))
      .finally(() => setStoresLoading(false));
  }

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadDetail(storeId: number, forDate: string) {
    setDetailLoading(true);
    setDetailError(null);
    getChecklistHistoryDetail(storeId, forDate)
      .then(setDetail)
      .catch((error: Error) => setDetailError(error.message))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => {
    if (selectedStoreId === null) return;
    setFilter('ALL');
    loadDetail(selectedStoreId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, date]);

  const rows = useMemo<StoreDetailRow[]>(() => {
    if (!detail) return [];
    return detail.categories.flatMap((category) =>
      category.tasks.map((task) => ({ key: `${category.id}-${task.id}`, categoryName: category.name, task })),
    );
  }, [detail]);

  const counts = useMemo(() => {
    let completed = 0;
    let open = 0;
    let issues = 0;
    for (const row of rows) {
      const status = taskStatus(row.task);
      if (status === 'COMPLETE') completed += 1;
      else if (status === 'OPEN') open += 1;
      else issues += 1;
    }
    return { total: rows.length, completed, open, issues };
  }, [rows]);

  const completionPercent = counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 100);

  const categoryProgress = useMemo(() => {
    if (!detail) return [];
    return detail.categories.map((category) => {
      const completed = category.tasks.filter((task) => taskStatus(task) === 'COMPLETE').length;
      return { id: category.id, name: category.name, completed, total: category.tasks.length };
    });
  }, [detail]);

  function loadReport() {
    setReportLoading(true);
    setReportError(null);
    getChecklistHistorySummary({
      storeIds: reportAllStores || selectedStoreId === null ? [] : [selectedStoreId],
      startDate: reportStartDate,
      endDate: reportEndDate,
    })
      .then(setReportRows)
      .catch((error: Error) => {
        setReportRows([]);
        setReportError(
          error instanceof ChecklistHistoryRangeError ? error.message : 'Failed to load the operations summary.',
        );
      })
      .finally(() => setReportLoading(false));
  }

  useEffect(() => {
    if (stores.length === 0) return;
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores.length, reportStartDate, reportEndDate, reportAllStores, selectedStoreId]);

  // One row per store, summed across every date in the selected range -- reuses
  // the exact Scheduled/Completed/Exception numbers the backend already computed
  // per store-per-day; this only combines them.
  const operationsSummary = useMemo(() => {
    const byStore = new Map<number, { storeId: number; storeName: string; scheduled: number; completed: number; exceptions: number }>();
    for (const row of reportRows) {
      const existing = byStore.get(row.storeId) ?? {
        storeId: row.storeId,
        storeName: row.storeName,
        scheduled: 0,
        completed: 0,
        exceptions: 0,
      };
      existing.scheduled += row.totalTasks;
      existing.completed += row.completedTasks;
      existing.exceptions += row.exceptionCount;
      byStore.set(row.storeId, existing);
    }
    return Array.from(byStore.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
  }, [reportRows]);

  const selectedStoreName = stores.find((store) => store.id === selectedStoreId)?.name ?? '';
  const reportScopeLabel = reportAllStores ? 'All Stores' : selectedStoreName || 'All Stores';
  const reportRangeLabel =
    reportStartDate === reportEndDate ? formatDateLabel(reportStartDate) : `${formatDateLabel(reportStartDate)} - ${formatDateLabel(reportEndDate)}`;

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((row) => taskStatus(row.task) === filter);
  }, [rows, filter]);

  function toggleFilter(next: FilterKey) {
    setFilter((current) => (current === next ? 'ALL' : next));
  }

  function handlePrintReport() {
    window.print();
  }

  return (
    <div className="store-detail-page">
      <div className="store-detail-page__header">
        <h1 className="store-detail-page__heading">Daily checklist</h1>
        <p className="store-detail-page__subheading">Every task for the selected store, with who recorded it.</p>
      </div>

      {storesError && (
        <div className="store-detail-page__error">
          {storesError}
          <button type="button" className="btn btn--secondary" onClick={loadStores}>
            Retry
          </button>
        </div>
      )}

      {!storesError && !storesLoading && stores.length === 0 && (
        <p className="store-detail-page__empty">No stores yet. Add one under Stores to get started.</p>
      )}

      {!storesError && stores.length > 0 && (
        <>
          <div className="filter-bar store-detail-page__filters">
            <label className="store-detail-page__date-field">
              Store
              <select
                value={selectedStoreId ?? ''}
                onChange={(event) => setSelectedStoreId(Number(event.target.value))}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="store-detail-page__date-field">
              Date
              <input
                type="date"
                value={date}
                max={todayDate()}
                onChange={(event) => setDate(event.target.value || todayDate())}
              />
            </label>
          </div>

          <div className="stat-card-row store-detail-page__stat-row">
            <button
              type="button"
              className={`store-detail-chip${filter === 'ALL' ? ' store-detail-chip--active' : ''}`}
              onClick={() => toggleFilter('ALL')}
            >
              <span className="store-detail-chip__value">{counts.total}</span>
              <span className="store-detail-chip__label">Total Tasks</span>
            </button>
            <button
              type="button"
              className={`store-detail-chip${filter === 'COMPLETE' ? ' store-detail-chip--active' : ''}`}
              onClick={() => toggleFilter('COMPLETE')}
            >
              <span className="store-detail-chip__value">{counts.completed}</span>
              <span className="store-detail-chip__label">Completed</span>
            </button>
            <button
              type="button"
              className={`store-detail-chip${filter === 'OPEN' ? ' store-detail-chip--active' : ''}`}
              onClick={() => toggleFilter('OPEN')}
            >
              <span className="store-detail-chip__value">{counts.open}</span>
              <span className="store-detail-chip__label">No Response</span>
            </button>
            <button
              type="button"
              className={`store-detail-chip store-detail-chip--danger${
                filter === 'ISSUE' ? ' store-detail-chip--active' : ''
              }`}
              onClick={() => toggleFilter('ISSUE')}
            >
              <span className="store-detail-chip__value">{counts.issues}</span>
              <span className="store-detail-chip__label">Issues</span>
            </button>
            <div className="store-detail-chip store-detail-chip--static">
              <span className="store-detail-chip__value">{completionPercent}%</span>
              <span className="store-detail-chip__label">Completion</span>
            </div>
          </div>

          {categoryProgress.length > 0 && (
            <div className="store-detail-page__category-progress">
              {categoryProgress.map((category) => (
                <span
                  key={category.id}
                  className={`badge ${category.total > 0 && category.completed === category.total ? 'badge--success' : 'badge--outline'}`}
                >
                  {category.name} {category.completed}/{category.total}
                </span>
              ))}
            </div>
          )}

          <p className="store-detail-page__hint">Click a box to filter · click again to clear</p>

          {detailError ? (
            <div className="store-detail-page__error">
              {detailError}
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => selectedStoreId !== null && loadDetail(selectedStoreId, date)}
              >
                Retry
              </button>
            </div>
          ) : (
            <StoreDetailTable rows={filteredRows} isLoading={detailLoading} hasChecklist={detail?.hasChecklist ?? false} />
          )}

          <div className="store-detail-page__report">
            <div className="store-detail-page__report-header store-detail-page__no-print">
              <div>
                <h2 className="store-detail-page__report-heading">Daily Operations Summary</h2>
                <p className="store-detail-page__subheading">
                  Scheduled, completed and exception counts per store over a date range.
                </p>
              </div>
              <button type="button" className="btn btn--secondary" onClick={handlePrintReport}>
                <Printer size={16} />
                Print
              </button>
            </div>

            <div className="store-detail-page__print-only store-detail-page__report-print-header">
              <h2>Daily Operations Summary</h2>
              <p>
                {reportScopeLabel} · {reportRangeLabel}
              </p>
            </div>

            <div className="filter-bar store-detail-page__filters store-detail-page__no-print">
              <label className="store-detail-page__date-field">
                Start Date *
                <input
                  type="date"
                  value={reportStartDate}
                  max={reportEndDate}
                  onChange={(event) => setReportStartDate(event.target.value || todayDate())}
                />
              </label>

              <label className="store-detail-page__date-field">
                End Date *
                <input
                  type="date"
                  value={reportEndDate}
                  min={reportStartDate}
                  max={todayDate()}
                  onChange={(event) => setReportEndDate(event.target.value || todayDate())}
                />
              </label>

              <label className="store-detail-page__all-stores-toggle">
                <input
                  type="checkbox"
                  checked={reportAllStores}
                  onChange={(event) => setReportAllStores(event.target.checked)}
                />
                All Stores
              </label>
            </div>

            {!reportAllStores && (
              <p className="store-detail-page__hint store-detail-page__no-print">
                Scoped to the store selected above ({selectedStoreName || '—'}). Check "All Stores" to include every store.
              </p>
            )}

            {reportError ? (
              <div className="store-detail-page__error store-detail-page__no-print">
                {reportError}
                <button type="button" className="btn btn--secondary" onClick={loadReport}>
                  Retry
                </button>
              </div>
            ) : (
              <div className="table-card">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Store</th>
                        <th scope="col">Scheduled</th>
                        <th scope="col">Completed</th>
                        <th scope="col">Completion %</th>
                        <th scope="col">Exceptions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operationsSummary.map((row) => {
                        const percent = row.scheduled === 0 ? 0 : Math.round((row.completed / row.scheduled) * 100);
                        return (
                          <tr key={row.storeId}>
                            <td data-label="Store">{row.storeName}</td>
                            <td data-label="Scheduled">{row.scheduled}</td>
                            <td data-label="Completed">{row.completed}</td>
                            <td data-label="Completion %">{percent}%</td>
                            <td data-label="Exceptions">{row.exceptions}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!reportLoading && operationsSummary.length === 0 && (
                  <div className="table-card__empty">No scheduled tasks in this date range.</div>
                )}
                {reportLoading && <div className="table-card__empty">Loading operations summary...</div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default StoreDetail;
