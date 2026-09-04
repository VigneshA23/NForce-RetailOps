import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getChecklistHistoryDetail } from '../api/checklistHistory';
import type { ChecklistHistoryDetail } from '../types/checklistHistory';
import type { SuperAdminStore } from '../types/superAdminStore';
import StoreDetailTable, { type StoreDetailRow } from '../components/StoreDetailTable';
import { taskStatus, todayDate } from '../utils/checklistHistoryOptions';
import '../pages/StoreDetail.css';
import './SuperAdminStoreDetail.css';

type FilterKey = 'ALL' | 'COMPLETE' | 'OPEN' | 'ISSUE';

interface SuperAdminStoreDetailProps {
  store: SuperAdminStore;
  onBack: () => void;
}

// Read-only single-day checklist view for one store, for the Super Admin's
// Stores page -- deliberately not StoreDetail.tsx's full page (which also
// pulls the multi-day operations-summary report): that report endpoint is
// intentionally Owner/Admin-only (see ChecklistHistoryControllerTest.
// superAdminIsBlockedFromSummaryEndpoint), so Super Admin only ever gets the
// single-day /checklist-history/detail view here.
function SuperAdminStoreDetail({ store, onBack }: SuperAdminStoreDetailProps) {
  const [date, setDate] = useState(todayDate);
  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');

  function load() {
    setIsLoading(true);
    setError(null);
    getChecklistHistoryDetail(store.storeId, date)
      .then(setDetail)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    setFilter('ALL');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.storeId, date]);

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

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((row) => taskStatus(row.task) === filter);
  }, [rows, filter]);

  function toggleFilter(next: FilterKey) {
    setFilter((current) => (current === next ? 'ALL' : next));
  }

  return (
    <div className="store-detail-page">
      <button type="button" className="super-admin-store-detail__back" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to Stores
      </button>

      <div className="store-detail-page__header">
        <h1 className="store-detail-page__heading">{store.storeName}</h1>
        <p className="store-detail-page__subheading">
          #{store.storeCode} · {store.storeLocation ?? 'No location on file'} · Owned by {store.ownerName ?? 'Unassigned'}
        </p>
      </div>

      <div className="filter-bar store-detail-page__filters">
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

      <p className="store-detail-page__hint">Click a box to filter · click again to clear</p>

      {error ? (
        <div className="store-detail-page__error">
          {error}
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <StoreDetailTable rows={filteredRows} isLoading={isLoading} hasChecklist={detail?.hasChecklist ?? false} />
      )}
    </div>
  );
}

export default SuperAdminStoreDetail;
