import { useEffect, useMemo, useState } from 'react';
import { getStores } from '../api/ownerStores';
import { getChecklistHistoryDetail } from '../api/checklistHistory';
import type { OwnerStore } from '../types/ownerStore';
import type { ChecklistHistoryDetail } from '../types/checklistHistory';
import StoreDetailTable, { type StoreDetailRow } from '../components/StoreDetailTable';
import { taskStatus, todayDate } from '../utils/checklistHistoryOptions';
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

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((row) => taskStatus(row.task) === filter);
  }, [rows, filter]);

  function toggleFilter(next: FilterKey) {
    setFilter((current) => (current === next ? 'ALL' : next));
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
          </div>

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
        </>
      )}
    </div>
  );
}

export default StoreDetail;
