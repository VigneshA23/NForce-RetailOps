import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Percent, X } from 'lucide-react';
import SearchInput from '../components/SearchInput';
import Select, { type SelectOption } from '../components/Select';
import StatCard from '../components/StatCard';
import UserAvatar from '../components/UserAvatar';
import { getInitials } from '../utils/initials';
import { getChecklistHistoryDetail } from '../api/checklistHistory';
import type { ChecklistHistoryResponseEntry } from '../types/checklistHistory';
import { getStoreTrend } from '../api/superAdminOperations';
import type { TrendDataPoint } from '../api/superAdminOperations';
import type { ChecklistHistoryDetail } from '../types/checklistHistory';
import StoreDetailTable, { type StoreDetailRow } from '../components/StoreDetailTable';
import TrendChart from '../components/TrendChart';
import CalendarPopover from '../components/CalendarPopover';
import ExportMenu from '../components/ExportMenu';
import { taskStatus, todayDate, yesterday, daysAgo, lastWeekSameDay, stepDate, formatDateNavLabel, responseDisplayValue, TASK_STATUS_LABELS } from '../utils/checklistHistoryOptions';
import { matchesSearch } from '../utils/search';
import { getAllStores } from '../api/superAdminStores';
import type { SuperAdminStore } from '../types/superAdminStore';
import './SuperAdminChecklist.css';

type FilterKey = 'ALL' | 'COMPLETE' | 'OPEN' | 'ISSUE';

// Session-scoped repeat-offender cache keyed by storeId (separate from owner-admin's cache in StoreDetail).
const saRepeatOffenderCache = new Map<number, Map<number, number>>();

export interface ChecklistNav {
  storeId: number;
  ts: number;
}

interface SuperAdminChecklistProps {
  nav?: ChecklistNav | null;
}

function SuperAdminChecklist({ nav }: SuperAdminChecklistProps) {
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(nav?.storeId ?? null);
  const appliedNavTs = useRef<number | undefined>(nav?.ts);

  const [date, setDate] = useState(todayDate);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);

  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [storeTrendDays, setStoreTrendDays] = useState<7 | 30>(30);
  const [storeTrendData, setStoreTrendData] = useState<TrendDataPoint[]>([]);
  const [storeTrendLoading, setStoreTrendLoading] = useState(false);

  const isToday = date === todayDate();

  // When parent navigates to a specific store (e.g. from Home table or Owners table),
  // update selectedStoreId. ts-based check ensures re-navigation to the same store still fires.
  useEffect(() => {
    if (nav && nav.ts !== appliedNavTs.current) {
      appliedNavTs.current = nav.ts;
      setSelectedStoreId(nav.storeId);
    }
  }, [nav]);

  useEffect(() => {
    getAllStores()
      .then((data) => setStores(data.filter((s) => s.storeActive)))
      .catch(() => {})
      .finally(() => setStoresLoading(false));
  }, []);

  function loadDetail(id: number, forDate: string, silent = false) {
    if (!silent) setDetailLoading(true);
    if (!silent) setDetailError(null);
    getChecklistHistoryDetail(id, forDate)
      .then(setDetail)
      .catch((error: Error) => { if (!silent) setDetailError(error.message); })
      .finally(() => { if (!silent) setDetailLoading(false); });
  }

  useEffect(() => {
    if (selectedStoreId === null) {
      setDetail(null);
      return;
    }
    setFilter('ALL');
    setSearchQuery('');
    setCategoryFilter('all');
    loadDetail(selectedStoreId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, date]);

  // 60-second background refresh for today's live data.
  useEffect(() => {
    if (selectedStoreId === null || !isToday) return;
    const id = window.setInterval(() => loadDetail(selectedStoreId, date, true), 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, date, isToday]);

  useEffect(() => {
    if (selectedStoreId === null) { setStoreTrendData([]); return; }
    let active = true;
    setStoreTrendLoading(true);
    getStoreTrend(selectedStoreId, storeTrendDays)
      .then((data) => { if (active) { setStoreTrendData(data); setStoreTrendLoading(false); } })
      .catch(() => { if (active) setStoreTrendLoading(false); });
    return () => { active = false; };
  }, [selectedStoreId, storeTrendDays]);

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

  // Trend vs yesterday (today-only).
  const [yesterdayPercent, setYesterdayPercent] = useState<number | null>(null);
  useEffect(() => {
    if (selectedStoreId === null || !isToday) {
      setYesterdayPercent(null);
      return;
    }
    getChecklistHistoryDetail(selectedStoreId, yesterday())
      .then((yd) => {
        const allTasks = yd.categories.flatMap((c) => c.tasks);
        if (allTasks.length === 0) { setYesterdayPercent(null); return; }
        const completedCount = allTasks.filter((t) => taskStatus(t) === 'COMPLETE').length;
        setYesterdayPercent(Math.round((completedCount / allTasks.length) * 100));
      })
      .catch(() => setYesterdayPercent(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, isToday]);

  const trendIndicator = useMemo(() => {
    if (!isToday || yesterdayPercent === null) return null;
    if (completionPercent > yesterdayPercent) {
      return { symbol: '↑', text: `Ahead of yesterday (${completionPercent}% vs ${yesterdayPercent}%)`, kind: 'ahead' as const };
    }
    if (completionPercent < yesterdayPercent) {
      return { symbol: '↓', text: `Behind yesterday's pace (${completionPercent}% vs ${yesterdayPercent}%)`, kind: 'behind' as const };
    }
    return { symbol: '≈', text: 'On pace with yesterday', kind: 'same' as const };
  }, [isToday, completionPercent, yesterdayPercent]);

  // Repeat-offender: 7-day session cache.
  const [repeatOffenderMap, setRepeatOffenderMap] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    if (selectedStoreId === null) return;
    const cached = saRepeatOffenderCache.get(selectedStoreId);
    if (cached) { setRepeatOffenderMap(cached); return; }
    const dates = Array.from({ length: 7 }, (_, i) => daysAgo(i + 1));
    Promise.allSettled(dates.map((d) => getChecklistHistoryDetail(selectedStoreId, d))).then((results) => {
      const tally = new Map<number, number>();
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const category of result.value.categories) {
          for (const task of category.tasks) {
            const s = taskStatus(task);
            if (s === 'OPEN' || s === 'ISSUE') {
              tally.set(task.id, (tally.get(task.id) ?? 0) + 1);
            }
          }
        }
      }
      saRepeatOffenderCache.set(selectedStoreId, tally);
      setRepeatOffenderMap(tally);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  const categoryProgress = useMemo(() => {
    if (!detail) return [];
    return detail.categories.map((category) => {
      const completed = category.tasks.filter((task) => taskStatus(task) === 'COMPLETE').length;
      return { id: category.id, name: category.name, completed, total: category.tasks.length };
    });
  }, [detail]);

  const availableCategories = useMemo<SelectOption[]>(() => {
    if (!detail) return [];
    return detail.categories.map((c) => ({ value: c.name, label: c.name }));
  }, [detail]);

  const filteredRows = useMemo(() => {
    let result = filter === 'ALL' ? rows : rows.filter((row) => taskStatus(row.task) === filter);
    if (categoryFilter !== 'all') {
      result = result.filter((row) => row.categoryName === categoryFilter);
    }
    if (searchQuery.trim()) {
      result = result.filter((row) =>
        matchesSearch(searchQuery, [
          row.categoryName,
          row.task.name,
          responseDisplayValue(row.task),
          TASK_STATUS_LABELS[taskStatus(row.task)],
          ...row.task.responses.map((r) => r.employeeFullName),
        ]),
      );
    }
    return result;
  }, [rows, filter, categoryFilter, searchQuery]);

  const employeeContributions = useMemo(() => {
    if (!detail) return [];
    type EmpData = { totalResponses: number; issueCount: number; byCategory: Map<string, number>; avatarUrl?: string | null };
    const byEmployee = new Map<string, EmpData>();
    for (const category of detail.categories) {
      for (const task of category.tasks) {
        for (const response of task.responses) {
          const name = response.employeeFullName;
          if (!byEmployee.has(name)) {
            byEmployee.set(name, { totalResponses: 0, issueCount: 0, byCategory: new Map(), avatarUrl: response.employeeAvatarUrl });
          }
          const emp = byEmployee.get(name)!;
          emp.totalResponses += 1;
          if (task.responseType === 'YES_NO' && response.booleanValue === false) {
            emp.issueCount += 1;
          }
          emp.byCategory.set(category.name, (emp.byCategory.get(category.name) ?? 0) + 1);
        }
      }
    }
    return Array.from(byEmployee.entries())
      .map(([name, data]) => ({
        name,
        avatarUrl: data.avatarUrl,
        totalResponses: data.totalResponses,
        issueCount: data.issueCount,
        categoryBreakdown: Array.from(data.byCategory.entries()).map(([categoryName, count]) => ({
          categoryName,
          count,
        })),
      }))
      .sort((a, b) => b.totalResponses - a.totalResponses);
  }, [detail]);

  const maxContributions = useMemo(
    () => employeeContributions.reduce((max, emp) => Math.max(max, emp.totalResponses), 0),
    [employeeContributions],
  );

  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  function toggleEmployeeExpanded(name: string) {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  const outstandingRows = useMemo(() => {
    if (!isToday) return [];
    return rows
      .filter((row) => {
        const s = taskStatus(row.task);
        return s === 'OPEN' || s === 'ISSUE';
      })
      .sort((a, b) => {
        const sa = taskStatus(a.task);
        const sb = taskStatus(b.task);
        if (sa !== sb) return sa === 'ISSUE' ? -1 : 1;
        return a.task.name.localeCompare(b.task.name);
      });
  }, [rows, isToday]);

  function handleResponseCorrected(taskId: number, updatedResponse: ChecklistHistoryResponseEntry) {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((category) => ({
          ...category,
          tasks: category.tasks.map((task) =>
            task.id !== taskId
              ? task
              : { ...task, responses: task.responses.map((r) => (r.id === updatedResponse.id ? updatedResponse : r)) },
          ),
        })),
      };
    });
  }

  const [outstandingOpen, setOutstandingOpen] = useState(false);
  useEffect(() => {
    setOutstandingOpen(counts.issues > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  function scrollToRow(key: string) {
    setFilter('ALL');
    setPendingScrollKey(key);
  }
  useEffect(() => {
    if (!pendingScrollKey) return;
    const el = document.getElementById(`task-row-${pendingScrollKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingScrollKey(null);
    }
  }, [pendingScrollKey, filteredRows]);

  const storeOptions = useMemo<SelectOption[]>(
    () => stores.map((s) => ({ value: String(s.storeId), label: s.storeName })),
    [stores],
  );

  return (
    <div className="sa-checklist">
      <div className="store-detail-page">
        <div className="store-detail-page__filters">
          <div className="store-detail-page__date-nav-row sa-checklist__top-row">
            {/* Date nav — LEFT */}
            <div className="store-detail-page__date-nav">
              <button
                type="button"
                className="store-detail-page__date-arrow"
                onClick={() => setDate(stepDate(date, -1))}
                aria-label="Previous day"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                ref={dateTriggerRef}
                type="button"
                className="store-detail-page__date-display"
                onClick={() => setPickerOpen((v) => !v)}
                aria-expanded={pickerOpen}
                aria-label="Pick a date"
              >
                <Calendar size={13} />
                {formatDateNavLabel(date)}
              </button>
              <button
                type="button"
                className="store-detail-page__date-arrow"
                onClick={() => setDate(stepDate(date, 1))}
                disabled={date >= todayDate()}
                aria-label="Next day"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {/* Live / Historical badge — same logic as Admin's checklist */}
            {isToday ? (
              <span className="store-detail-page__mode-badge store-detail-page__mode-badge--live">
                ● Live
              </span>
            ) : (
              <span className="store-detail-page__mode-badge store-detail-page__mode-badge--historical">
                📋 Historical
              </span>
            )}
            {/* Spacer pushes store selector to the right */}
            <div style={{ flex: 1 }} />
            {/* Store selector — RIGHT, amber accent when no store selected */}
            <select
              id="sa-store-select"
              className={`select sa-checklist__store-select${selectedStoreId === null ? ' sa-checklist__store-select--unselected' : ''}`}
              value={selectedStoreId !== null ? String(selectedStoreId) : ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStoreId(val ? Number(val) : null);
              }}
              disabled={storesLoading}
            >
              {storesLoading && selectedStoreId !== null
                ? <option value={String(selectedStoreId)}>Loading stores…</option>
                : <option value="">Select a store…</option>
              }
              {storeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedStoreId !== null && <ExportMenu storeId={selectedStoreId} date={date} />}
          </div>
            <CalendarPopover
              value={date}
              max={todayDate()}
              isOpen={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={(d) => setDate(d)}
              anchorRef={dateTriggerRef}
            />
            <div className="store-detail-page__date-pills">
              <button
                type="button"
                className={`store-detail-page__date-pill${date === yesterday() ? ' store-detail-page__date-pill--active' : ''}`}
                onClick={() => setDate(yesterday())}
              >
                Yesterday
              </button>
              <button
                type="button"
                className="store-detail-page__date-pill"
                onClick={() => setDate(lastWeekSameDay(date))}
              >
                Last Week
              </button>
              {date !== todayDate() && (
                <button
                  type="button"
                  className="store-detail-page__date-pill store-detail-page__date-pill--today"
                  onClick={() => setDate(todayDate())}
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {/* Stat tiles always visible — zero values before store selected */}
          <><div className="stat-card-row store-detail-page__stat-row">
            <StatCard icon={ClipboardList} label="Total Tasks" value={counts.total} tone="info" />
            <StatCard icon={CheckCircle2} label="Completed" value={counts.completed} tone="success" />
            <StatCard icon={Clock} label="No Response" value={counts.open} tone="warning" />
            <StatCard icon={Percent} label="Completion" value={`${completionPercent}%`} tone="primary" />
          </div>

          {categoryProgress.length > 0 && (
            <div className="store-detail-page__category-progress">
              {categoryProgress.map((category) => {
                const pct = category.total === 0 ? 0 : (category.completed / category.total) * 100;
                const done = category.total > 0 && category.completed === category.total;
                return (
                  <div key={category.id} className={`cat-prog-card${done ? ' cat-prog-card--done' : ''}`}>
                    <span className="cat-prog-card__name">{category.name}</span>
                    <div className="cat-prog-card__track">
                      <div className="cat-prog-card__fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="cat-prog-card__count">{category.completed}/{category.total}</span>
                  </div>
                );
              })}
            </div>
          )}

          {trendIndicator && (
            <p className={`store-detail-page__trend store-detail-page__trend--${trendIndicator.kind}`}>
              {trendIndicator.symbol} {trendIndicator.text}
            </p>
          )}

          {selectedStoreId !== null && (
            <div className="sa-checklist__trend-section">
              <div className="sa-checklist__trend-header">
                <span className="sa-checklist__trend-title">Store Completion Trend</span>
                <div className="sa-checklist__trend-toggle">
                  {([7, 30] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`sa-checklist__trend-btn${storeTrendDays === d ? ' sa-checklist__trend-btn--active' : ''}`}
                      onClick={() => setStoreTrendDays(d)}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <TrendChart data={storeTrendData} loading={storeTrendLoading} height={140} compact />
            </div>
          )}

          {selectedStoreId !== null && employeeContributions.length > 0 && (
            <div className="store-detail-page__contributions">
              <h2 className="store-detail-page__contributions-title">Employee Contributions</h2>
              {employeeContributions.map((emp) => {
                const barWidth = maxContributions === 0 ? 0 : Math.round((emp.totalResponses / maxContributions) * 100);
                const isExpanded = expandedEmployees.has(emp.name);
                return (
                  <div key={emp.name} className="store-detail-contrib">
                    <button
                      type="button"
                      className="store-detail-contrib__header"
                      onClick={() => toggleEmployeeExpanded(emp.name)}
                      aria-expanded={isExpanded}
                    >
                      <UserAvatar initials={getInitials(emp.name)} src={emp.avatarUrl} size={28} />
                      <span className="store-detail-contrib__name">{emp.name}</span>
                      <span className="store-detail-contrib__bar-wrap" aria-hidden="true">
                        <span
                          className="store-detail-contrib__bar"
                          style={{ width: `${barWidth}%` }}
                        />
                      </span>
                      <span className="store-detail-contrib__count">
                        {emp.totalResponses} {emp.totalResponses === 1 ? 'task' : 'tasks'}
                      </span>
                      {emp.issueCount > 0 && (
                        <span className="store-detail-contrib__issues">{emp.issueCount} issue{emp.issueCount !== 1 ? 's' : ''}</span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`store-detail-contrib__chevron${isExpanded ? ' store-detail-contrib__chevron--open' : ''}`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="store-detail-contrib__breakdown">
                        {emp.categoryBreakdown.map((cat) => (
                          <div key={cat.categoryName} className="store-detail-contrib__breakdown-item">
                            <span className="store-detail-contrib__breakdown-category">{cat.categoryName}</span>
                            <span className="store-detail-contrib__breakdown-count">{cat.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedStoreId !== null && isToday && outstandingRows.length > 0 && (
            <div className="store-detail-outstanding">
              <button
                type="button"
                className="store-detail-outstanding__toggle"
                onClick={() => setOutstandingOpen((v) => !v)}
                aria-expanded={outstandingOpen}
              >
                <span className="store-detail-outstanding__title">
                  Outstanding Tasks
                  <span className="store-detail-outstanding__count">{outstandingRows.length}</span>
                </span>
                <ChevronDown
                  size={14}
                  className={`store-detail-outstanding__chevron${outstandingOpen ? ' store-detail-outstanding__chevron--open' : ''}`}
                />
              </button>
              {outstandingOpen && (
                <ul className="store-detail-outstanding__list">
                  {outstandingRows.map((row) => {
                    const status = taskStatus(row.task);
                    return (
                      <li key={row.key}>
                        <button
                          type="button"
                          className="store-detail-outstanding__row"
                          onClick={() => scrollToRow(row.key)}
                        >
                          <span className="store-detail-outstanding__category">{row.categoryName}</span>
                          <span className="store-detail-outstanding__task">{row.task.name}</span>
                          <span className={`badge ${status === 'ISSUE' ? 'badge--danger' : 'badge--outline'}`}>
                            {status === 'ISSUE' ? 'Issue' : 'Open'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="filter-bar store-detail-page__task-filter">
            <div className="filter filter--search">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search tasks, employees, status…"
                variant="filter"
              />
            </div>
            {availableCategories.length > 0 && (
              <Select
                className="filter"
                options={[{ value: 'all', label: 'All categories' }, ...availableCategories]}
                value={categoryFilter}
                onChange={setCategoryFilter}
                ariaLabel="Filter by category"
              />
            )}
            <Select
              className="filter"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'COMPLETE', label: 'Completed' },
                { value: 'OPEN', label: 'No Response' },
                { value: 'ISSUE', label: 'Issues' },
              ]}
              value={filter}
              onChange={(v) => setFilter(v as FilterKey)}
              ariaLabel="Filter by status"
            />
            {(searchQuery || categoryFilter !== 'all' || filter !== 'ALL') && (
              <button
                type="button"
                className="store-detail-page__filter-clear"
                onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setFilter('ALL'); }}
                aria-label="Clear filters"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>

          {selectedStoreId === null ? (
            <div className="table-card">
              <div className="table-card__empty sa-checklist__no-store-msg">
                Select a store above to view its daily checklist.
              </div>
            </div>
          ) : detailError ? (
            <div className="store-detail-page__error">
              {detailError}
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => loadDetail(selectedStoreId, date)}
              >
                Retry
              </button>
            </div>
          ) : (
            <StoreDetailTable
              rows={filteredRows}
              isLoading={detailLoading}
              hasChecklist={detail?.hasChecklist ?? false}
              repeatOffenderMap={repeatOffenderMap}
              onResponseCorrected={handleResponseCorrected}
              onResponseFlagged={handleResponseCorrected}
            />
          )}</>
      </div>
    </div>
  );
}

export default SuperAdminChecklist;
