import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getChecklistHistorySummary, ChecklistHistoryRangeError } from '../api/checklistHistory';
import type { ChecklistHistorySummaryRow } from '../types/checklistHistory';
import { daysAgo, todayDate, MAX_RANGE_DAYS } from '../utils/checklistHistoryOptions';
import ChecklistHistoryTable from '../components/ChecklistHistoryTable';
import ChecklistHistoryDetailModal, { type ChecklistHistoryDetailTarget } from '../components/ChecklistHistoryDetailModal';
import './History.css';

function History() {
  const [startDate, setStartDate] = useState(() => daysAgo(6));
  const [endDate, setEndDate] = useState(todayDate);
  const [rows, setRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<ChecklistHistoryDetailTarget | null>(null);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    // storeIds omitted -- the backend always resolves this Owner/Admin's own
    // authorized store(s), so this page never needs (or offers) a store filter.
    getChecklistHistorySummary({ storeIds: [], startDate, endDate })
      .then(setRows)
      .catch((err: Error) => {
        setLoadError(err instanceof ChecklistHistoryRangeError ? err.message : 'Failed to load checklist history');
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, [startDate, endDate]);

  return (
    <div className="history-page">
      {loadError && (
        <div className="owners-page__error">
          <AlertCircle size={18} className="owners-page__error-icon" aria-hidden="true" />
          <span className="owners-page__error-message">{loadError}</span>
          <button type="button" className="btn btn--secondary" onClick={load}>Retry</button>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter history-page__range-filter">
          <label className="history-page__range-label">
            From
            <input
              type="date"
              className="input"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
        </div>
        <div className="filter history-page__range-filter">
          <label className="history-page__range-label">
            To
            <input
              type="date"
              className="input"
              value={endDate}
              min={startDate}
              max={todayDate()}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
        <span className="history-page__range-hint">Max {MAX_RANGE_DAYS} days</span>
      </div>

      <ChecklistHistoryTable
        rows={rows}
        isLoading={isLoading}
        onView={(row) => setDetailTarget({ storeId: row.storeId, storeName: row.storeName, date: row.date })}
      />

      <ChecklistHistoryDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  );
}

export default History;
