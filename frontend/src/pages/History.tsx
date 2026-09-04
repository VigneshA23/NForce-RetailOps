import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import ChecklistHistoryTable from '../components/ChecklistHistoryTable';
import ChecklistHistoryDetailModal, {
  type ChecklistHistoryDetailTarget,
} from '../components/ChecklistHistoryDetailModal';
import { getChecklistHistorySummary } from '../api/checklistHistory';
import type { ChecklistHistorySummaryRow } from '../types/checklistHistory';
import { todayDate } from '../utils/checklistHistoryOptions';
import './History.css';

function History() {
  const [selectedDate, setSelectedDate] = useState(todayDate);

  const [rows, setRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [detailTarget, setDetailTarget] = useState<ChecklistHistoryDetailTarget | null>(null);

  function runSearch() {
    setSummaryLoading(true);
    setSummaryError(null);
    getChecklistHistorySummary({
      storeIds: [],
      startDate: selectedDate,
      endDate: selectedDate,
    })
      .then(setRows)
      .catch((error: Error) => setSummaryError(error.message))
      .finally(() => setSummaryLoading(false));
  }

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.storeName.localeCompare(b.storeName) || a.date.localeCompare(b.date)),
    [rows],
  );

  return (
    <div className="history-page">
      <div className="history-page__header">
        <div>
          <h1 className="history-page__heading">Checklist History</h1>
          <p className="history-page__subheading">
            Review completed checklists and their status for any date.
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter filter--narrow">
          <input
            type="date"
            className="input"
            aria-label="Date"
            value={selectedDate}
            max={todayDate()}
            onChange={(event) => setSelectedDate(event.target.value || todayDate())}
          />
        </div>

        <button type="button" className="btn btn--primary" disabled={summaryLoading} onClick={runSearch}>
          <SearchIcon size={16} />
          Search
        </button>
      </div>

      {summaryError && (
        <div className="history-page__error">
          {summaryError}
          <button type="button" className="btn btn--secondary" onClick={runSearch}>
            Retry
          </button>
        </div>
      )}

      <ChecklistHistoryTable
        rows={sortedRows}
        isLoading={summaryLoading}
        onView={(row) => setDetailTarget({ storeId: row.storeId, storeName: row.storeName, date: row.date })}
      />

      <ChecklistHistoryDetailModal target={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  );
}

export default History;
