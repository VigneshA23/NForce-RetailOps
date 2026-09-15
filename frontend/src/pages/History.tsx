import { useEffect, useState } from 'react';
import { getChecklistHistoryDetail, getCorrectionHistory } from '../api/checklistHistory';
import type { ShiftHistory } from '../types/history';
import { toShiftHistory } from '../utils/checklistHistoryToShiftHistory';
import ChecklistDayHistoryView from '../components/ChecklistDayHistoryView';

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

interface HistoryProps {
  storeId: number | null;
}

function History({ storeId }: HistoryProps) {
  const [selectedDate, setSelectedDate] = useState(yesterdayDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState<ShiftHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadHistory() {
    if (!storeId) {
      setLoading(false);
      setHistory(null);
      setError('No store assigned yet.');
      return () => {};
    }
    let active = true;
    setLoading(true);
    setError(null);

    getChecklistHistoryDetail(storeId, selectedDate)
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
  }, [storeId, selectedDate]);

  return (
    <ChecklistDayHistoryView
      history={history}
      loading={loading}
      error={error}
      onRetry={loadHistory}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      maxDate={todayDate()}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      getCorrectionHistory={getCorrectionHistory}
    />
  );
}

export default History;
