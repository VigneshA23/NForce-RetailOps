import { useEffect, useMemo, useState } from 'react';
import { getChecklistHistoryDetail } from '../api/checklistHistory';
import type { ChecklistHistoryDetail } from '../types/checklistHistory';
import StoreDetailTable, { type StoreDetailRow } from '../components/StoreDetailTable';
import { taskStatus, todayDate } from '../utils/checklistHistoryOptions';
import './StoreDetail.css';

type FilterKey = 'ALL' | 'COMPLETE' | 'OPEN' | 'ISSUE';

interface StoreDetailProps {
  storeId: number | null;
}

function StoreDetail({ storeId }: StoreDetailProps) {
  const [date, setDate] = useState(todayDate);

  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('ALL');

  function loadDetail(id: number, forDate: string) {
    setDetailLoading(true);
    setDetailError(null);
    getChecklistHistoryDetail(id, forDate)
      .then(setDetail)
      .catch((error: Error) => setDetailError(error.message))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => {
    if (storeId === null) return;
    setFilter('ALL');
    loadDetail(storeId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, date]);

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

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((row) => taskStatus(row.task) === filter);
  }, [rows, filter]);

  function toggleFilter(next: FilterKey) {
    setFilter((current) => (current === next ? 'ALL' : next));
  }

  if (storeId === null) {
    return (
      <div className="store-detail-page">
        <p className="store-detail-page__empty">No store assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="store-detail-page">
      <div className="store-detail-page__header">
        <h1 className="store-detail-page__heading">Daily checklist</h1>
        <p className="store-detail-page__subheading">Every task for your store, with who recorded it.</p>
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
            onClick={() => loadDetail(storeId, date)}
          >
            Retry
          </button>
        </div>
      ) : (
        <StoreDetailTable rows={filteredRows} isLoading={detailLoading} hasChecklist={detail?.hasChecklist ?? false} />
      )}
    </div>
  );
}

export default StoreDetail;
