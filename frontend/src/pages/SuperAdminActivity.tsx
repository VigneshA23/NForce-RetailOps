import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import SearchInput from '../components/SearchInput';
import Select, { type SelectOption } from '../components/Select';
import FilterClearButton from '../components/FilterClearButton';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange, type DateRangeSelection } from '../components/DateRangePicker';
import Pagination from '../components/Pagination';
import { ActivityFeedRow } from '../components/ActivityFeedList';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { getAllStores } from '../api/superAdminStores';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { ActivityLogEntry } from '../types/activity';
import { matchesSearch } from '../utils/search';
import { formatTimeLabel, todayDate, yesterday } from '../utils/checklistHistoryOptions';
import './SuperAdminActivity.css';

// Server caps `limit` at 100 (ActivityLogController.MAX_LIMIT) -- this is
// the largest single page the API can return for a given date range.
const FULL_LIMIT = 100;
const PAGE_SIZE = 10;

interface SuperAdminActivityProps {
  // Leaves this page entirely (e.g. back to Home) -- this page is only
  // reachable via "View all", so there's no tab of its own to fall back to.
  onBack?: () => void;
}

// YYYY-MM-DD in the viewer's local timezone, matching how todayDate()/
// yesterday() in checklistHistoryOptions.ts define "today" elsewhere in the app.
function localDateKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "Tue, SEP 22, 2026" -- weekday and month both abbreviated (month
// uppercased), used for the Today/Yesterday subheading next to the heading.
function fullDateLabel(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  const month = date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  return `${weekday}, ${month} ${date.getDate()}, ${date.getFullYear()}`;
}

interface DayGroup {
  dateKey: string;
  heading: string;
  // Empty for anything older than yesterday -- the heading alone ("Saturday,
  // Sep 19, 2026") already says which day it was, so a trailing "3 days ago"
  // next to it (and repeated again on every row below) was pure redundancy.
  subheading: string;
  isToday: boolean;
  entries: ActivityLogEntry[];
}

function groupByDay(entries: ActivityLogEntry[]): DayGroup[] {
  const todayKey = todayDate();
  const yesterdayKey = yesterday();
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();

  for (const entry of entries) {
    const dateKey = localDateKey(entry.occurredAt);
    let group = byKey.get(dateKey);
    if (!group) {
      const date = new Date(`${dateKey}T00:00:00`);
      let heading: string;
      let subheading = '';
      if (dateKey === todayKey) {
        heading = 'Today';
        subheading = fullDateLabel(date);
      } else if (dateKey === yesterdayKey) {
        heading = 'Yesterday';
        subheading = fullDateLabel(date);
      } else {
        heading = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      }
      group = { dateKey, heading, subheading, isToday: dateKey === todayKey, entries: [] };
      byKey.set(dateKey, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  return groups;
}

function SuperAdminActivity({ onBack }: SuperAdminActivityProps) {
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [page, setPage] = useState(1);
  const [stores, setStores] = useState<SuperAdminStore[]>([]);

  const resolvedRange = resolveDateRange(dateRange);
  const entries = useRecentActivity(FULL_LIMIT, resolvedRange);

  useEffect(() => {
    getAllStores().then(setStores).catch(() => {});
  }, []);

  const storeOptions = useMemo<SelectOption[]>(
    () => stores
      .map((store) => ({ value: store.storeName, label: store.storeName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [stores],
  );

  const filteredEntries = useMemo(() => {
    if (!entries) return entries;
    let result = entries;
    if (storeFilter !== 'all') {
      result = result.filter((entry) => entry.storeName === storeFilter);
    }
    if (search.trim()) {
      result = result.filter((entry) =>
        matchesSearch(search, [entry.actorName, entry.description, entry.storeName, entry.entityName]),
      );
    }
    return result;
  }, [entries, storeFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [search, storeFilter, dateRange]);

  const totalItems = filteredEntries?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = (filteredEntries ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const dayGroups = useMemo(() => groupByDay(pagedEntries), [pagedEntries]);

  return (
    <div className="sa-activity">
      {onBack && (
        <button type="button" className="sa-activity__back" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>
      )}

      <div className="sa-activity__header">
        <h1 className="sa-activity__title">Recent Activity</h1>
        <p className="sa-activity__subtitle">Owner and employee activity across every store, chronologically grouped.</p>
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search activity, task, employee…" variant="filter" />
        </div>
        {storeOptions.length > 1 && (
          <Select
            className="filter"
            options={[{ value: 'all', label: 'All stores' }, ...storeOptions]}
            value={storeFilter}
            onChange={setStoreFilter}
            ariaLabel="Filter by store"
          />
        )}
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        {(storeFilter !== 'all' || dateRange.preset !== 'ALL_TIME') && (
          <FilterClearButton onClick={() => { setStoreFilter('all'); setDateRange(DEFAULT_DATE_RANGE); }} />
        )}
      </div>

      <div className="card sa-activity__list-card">
        {entries === null && <p className="sa-activity__empty">Loading…</p>}
        {entries !== null && dayGroups.length === 0 && (
          <p className="sa-activity__empty">No activity in this range.</p>
        )}
        {dayGroups.map((group) => (
          <div key={group.dateKey} className="sa-activity__day-group">
            <div className="sa-activity__day-header">
              <div className="sa-activity__day-heading-group">
                <span className="sa-activity__day-heading">{group.heading}</span>
                {group.subheading && (
                  <>
                    <span className="sa-activity__day-dot" aria-hidden="true">•</span>
                    <span className="sa-activity__day-subheading">{group.subheading}</span>
                  </>
                )}
              </div>
              <span className="badge badge--outline sa-activity__day-count">
                {group.entries.length} event{group.entries.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="sa-activity__day-rows">
              {group.entries.map((entry) => (
                <ActivityFeedRow
                  key={entry.id}
                  entry={entry}
                  timeLabel={group.isToday ? undefined : formatTimeLabel(entry.occurredAt)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {totalItems > 0 && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

export default SuperAdminActivity;
