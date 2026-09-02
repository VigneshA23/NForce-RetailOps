import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import ChecklistHistoryTable from '../components/ChecklistHistoryTable';
import ChecklistHistoryDetailModal, {
  type ChecklistHistoryDetailTarget,
} from '../components/ChecklistHistoryDetailModal';
import { getStores } from '../api/ownerStores';
import { getChecklistHistorySummary } from '../api/checklistHistory';
import type { ChecklistHistorySummaryRow } from '../types/checklistHistory';
import type { OwnerStore } from '../types/ownerStore';
import { MAX_RANGE_DAYS, diffDaysInclusive, todayDate } from '../utils/checklistHistoryOptions';
import './History.css';

function History() {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [allStoresSelected, setAllStoresSelected] = useState(true);

  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);

  const [rows, setRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [detailTarget, setDetailTarget] = useState<ChecklistHistoryDetailTarget | null>(null);

  function loadStores() {
    setStoresLoading(true);
    setStoresError(null);
    getStores()
      .then(setStores)
      .catch((error: Error) => setStoresError(error.message))
      .finally(() => setStoresLoading(false));
  }

  function runSearch() {
    setSummaryLoading(true);
    setSummaryError(null);
    getChecklistHistorySummary({
      storeIds: allStoresSelected ? [] : selectedStoreIds,
      startDate,
      endDate,
    })
      .then(setRows)
      .catch((error: Error) => setSummaryError(error.message))
      .finally(() => setSummaryLoading(false));
  }

  // Fire once on mount with the default filters (today, all stores). Every
  // subsequent fetch is triggered explicitly by the Search button rather than
  // by reacting to filter state changes, since a wide store x date-range query
  // is expensive server-side and this codebase never auto-refetches from the
  // server on filter changes elsewhere.
  useEffect(() => {
    loadStores();
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeSpanDays = diffDaysInclusive(startDate, endDate);
  const isRangeValid = startDate <= endDate && rangeSpanDays <= MAX_RANGE_DAYS;
  const hasStoreSelection = allStoresSelected || selectedStoreIds.length > 0;

  const rangeValidationMessage = startDate > endDate
    ? 'Start date must be on or before end date.'
    : rangeSpanDays > MAX_RANGE_DAYS
      ? `Select a range of ${MAX_RANGE_DAYS} days or fewer.`
      : !hasStoreSelection
        ? 'Select at least one store, or choose All Stores.'
        : null;

  const canSearch = isRangeValid && hasStoreSelection && !summaryLoading;

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
            Review completed checklists and their status for any store and date.
          </p>
        </div>
      </div>

      <div className="filter-bar history-page__filters">
        <div className="filter">
          <SearchableSelect
            id="history-stores"
            multiple
            placeholder="Search and select stores"
            options={stores.map((store) => ({ id: store.id, label: store.name }))}
            selectedIds={selectedStoreIds}
            onChange={setSelectedStoreIds}
            isLoading={storesLoading}
            error={storesError}
            onRetry={loadStores}
            emptyMessage="No stores yet."
            allOption={{
              label: 'All Stores',
              selected: allStoresSelected,
              onToggle: () => {
                setAllStoresSelected((current) => !current);
                setSelectedStoreIds([]);
              },
            }}
          />
        </div>

        <label className="history-page__date-field">
          From
          <input
            type="date"
            value={startDate}
            max={todayDate()}
            onChange={(event) => setStartDate(event.target.value || todayDate())}
          />
        </label>

        <label className="history-page__date-field">
          To
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayDate()}
            onChange={(event) => setEndDate(event.target.value || todayDate())}
          />
        </label>

        <button type="button" className="btn btn--primary" disabled={!canSearch} onClick={runSearch}>
          <SearchIcon size={16} />
          Search
        </button>
      </div>

      {rangeValidationMessage && <p className="history-page__validation">{rangeValidationMessage}</p>}

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
