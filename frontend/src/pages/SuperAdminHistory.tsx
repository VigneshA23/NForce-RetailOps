import { useEffect, useState } from 'react';
import { getChecklistHistoryDetail, getCorrectionHistory } from '../api/checklistHistory';
import { getAllStores } from '../api/superAdminStores';
import type { ShiftHistory } from '../types/history';
import { toShiftHistory } from '../utils/checklistHistoryToShiftHistory';
import ChecklistDayHistoryView from '../components/ChecklistDayHistoryView';
import SearchableSelect, { type SearchableSelectOption } from '../components/SearchableSelect';

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDate(): string {
  return toDateKey(new Date());
}

function yesterdayDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDateKey(date);
}

function SuperAdminHistory() {
  const [storeOptions, setStoreOptions] = useState<SearchableSelectOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(yesterdayDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState<ShiftHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStoresLoading(true);
    getAllStores()
      .then((stores) => {
        setStoreOptions(stores.map((store) => ({ id: store.storeId, label: store.storeName })));
        setSelectedStoreId((current) => current ?? stores[0]?.storeId ?? null);
      })
      .catch(() => {})
      .finally(() => setStoresLoading(false));
  }, []);

  function loadHistory() {
    if (!selectedStoreId) {
      setLoading(false);
      setHistory(null);
      setError(storesLoading ? null : 'No stores available.');
      return () => {};
    }
    let active = true;
    setLoading(true);
    setError(null);

    getChecklistHistoryDetail(selectedStoreId, selectedDate)
      .then((result) => {
        if (!active) return;
        setHistory(toShiftHistory(result));
      })
      .catch((err: Error) => {
        if (!active) return;
        setHistory(null);
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }

  useEffect(() => {
    const cancel = loadHistory();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, selectedDate]);

  return (
    <ChecklistDayHistoryView
      history={history}
      loading={loading || storesLoading}
      error={error}
      onRetry={loadHistory}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      maxDate={todayDate()}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      getCorrectionHistory={getCorrectionHistory}
      extraFilters={
        <div className="employee-history-extra-filter">
          <SearchableSelect
            id="history-store-select"
            options={storeOptions}
            selectedIds={selectedStoreId != null ? [selectedStoreId] : []}
            onChange={(ids) => setSelectedStoreId(ids[0] ?? null)}
            placeholder="Select store"
            isLoading={storesLoading}
          />
        </div>
      }
    />
  );
}

export default SuperAdminHistory;
