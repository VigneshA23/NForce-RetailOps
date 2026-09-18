import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, Calendar, CheckCircle2, ListChecks, Users, Tags } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { getChecklistHistoryDetail, getChecklistHistorySummary } from '../api/checklistHistory';
import { getIssues } from '../api/issues';
import type { Issue } from '../types/issue';
import type { OwnerStore } from '../types/ownerStore';
import type { Employee } from '../types/employee';
import type { Category } from '../types/category';
import type { ChecklistHistorySummaryRow } from '../types/checklistHistory';
import StatCard from '../components/StatCard';
import RecentActivityCard from '../components/RecentActivityCard';
import ChartCard from '../components/ChartCard';
import CompletionRateCard from '../components/CompletionRateCard';
import { getInitials, firstName } from '../utils/initials';
import './Home.css';

// Cycled by row position so each contributor gets a visually distinct avatar
// color -- there's no per-user color stored anywhere to draw from instead.
const CONTRIBUTOR_AVATAR_COLORS = ['#e11d33', '#1e293b', '#2563eb', '#7c3aed', '#0d9488', '#ca8a04'];

interface HomeProps {
  userName: string;
  stores: OwnerStore[];
  storesLoading: boolean;
  employees: Employee[];
  categories: Category[];
  onViewStoreDetail: () => void;
  onViewIssues?: () => void;
  onViewEmployees?: () => void;
  onViewCategories?: () => void;
}

const DEFAULT_TREND_DAYS = 7;

// Local calendar date, not UTC -- .toISOString() converts to UTC first, which
// silently rolls the date back a day for any timezone ahead of UTC (e.g.
// IST) during the hours after local midnight but before UTC midnight.
function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toLocalIsoDate(date);
}

// Weekday name at a glance for a short window; "Mon"/"Tue" repeats and gets
// ambiguous once the window spans more than a week, so a longer period spells
// out the date instead.
function formatDayLabel(isoDate: string, periodDays: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return periodDays <= 7
    ? date.toLocaleDateString(undefined, { weekday: 'short' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// completedTasks/totalTasks as a whole-number percent, 0 for a day/store with
// no tasks at all rather than NaN or a misleading 100%.
function completionPercent(totalTasks: number, completedTasks: number): number {
  return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
}

function sumTasks(rows: ChecklistHistorySummaryRow[]): { totalTasks: number; completedTasks: number } {
  return rows.reduce(
    (sum, row) => ({ totalTasks: sum.totalTasks + row.totalTasks, completedTasks: sum.completedTasks + row.completedTasks }),
    { totalTasks: 0, completedTasks: 0 },
  );
}

function Home({
  userName,
  stores,
  storesLoading,
  employees,
  categories,
  onViewStoreDetail,
  onViewIssues,
  onViewEmployees,
  onViewCategories,
}: HomeProps) {
  const [todayRows, setTodayRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [trend, setTrend] = useState<{ day: string; completion: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ id: number; name: string; completed: number; total: number }[]>([]);
  const [employeeTaskCounts, setEmployeeTaskCounts] = useState<
    { id: number; name: string; avatarUrl: string | null; taskCount: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(DEFAULT_TREND_DAYS);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Issues state — null = not yet loaded (avoids false "All clear" before API resolves)
  const [issues, setIssues] = useState<Issue[] | null>(null);

  // Today's summary + per-category breakdown: depends only on the store list,
  // not on the trend window, so toggling 7d/30d below doesn't re-fetch this.
  useEffect(() => {
    if (storesLoading) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    const storeIds = stores.map((store) => store.id);

    (async () => {
      if (storeIds.length === 0) {
        if (active) {
          setTodayRows([]);
          setCategoryBreakdown([]);
          setEmployeeTaskCounts([]);
        }
        return;
      }

      const today = isoDateDaysAgo(0);
      const [todaySummary, details] = await Promise.all([
        getChecklistHistorySummary({ storeIds, startDate: today, endDate: today }),
        Promise.all(storeIds.map((id) => getChecklistHistoryDetail(id, today))),
      ]);

      if (!active) return;
      setTodayRows(todaySummary);

      const categoryTotals = new Map<number, { name: string; completed: number; total: number }>();
      // Distinct tasks each employee has an active response for today, keyed by
      // employee id -- a task set (not a raw response count) so a MULTIPLE task
      // with more than one submission from the same employee still counts once.
      const employeeTaskIds = new Map<number, { name: string; avatarUrl: string | null; taskIds: Set<number> }>();
      details.forEach((detail) => {
        detail.categories.forEach((category) => {
          const existing = categoryTotals.get(category.id) ?? { name: category.name, completed: 0, total: 0 };
          existing.total += category.tasks.length;
          existing.completed += category.tasks.filter((task) => task.completed).length;
          categoryTotals.set(category.id, existing);

          category.tasks.forEach((task) => {
            task.responses.forEach((response) => {
              const employee = employeeTaskIds.get(response.employeeUserId)
                ?? { name: response.employeeFullName, avatarUrl: response.employeeAvatarUrl ?? null, taskIds: new Set<number>() };
              employee.taskIds.add(task.id);
              employeeTaskIds.set(response.employeeUserId, employee);
            });
          });
        });
      });
      setEmployeeTaskCounts(
        Array.from(employeeTaskIds.entries()).map(([id, employee]) => ({
          id,
          name: employee.name,
          avatarUrl: employee.avatarUrl,
          taskCount: employee.taskIds.size,
        })),
      );
      setCategoryBreakdown(
        Array.from(categoryTotals.entries()).map(([id, totals]) => ({ id, ...totals })),
      );
    })()
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [storesLoading, stores, retryTick]);

  // Trend series: depends on trendDays too, but only re-fetches the trend
  // summary itself, not today's summary/category breakdown above.
  useEffect(() => {
    if (storesLoading) return;
    let active = true;

    const storeIds = stores.map((store) => store.id);
    if (storeIds.length === 0) {
      setTrend([]);
      return;
    }

    const today = isoDateDaysAgo(0);
    // Rolling window: oldest day on the left, today on the right.
    const trendStartDate = isoDateDaysAgo(trendDays - 1);
    const trendDates = Array.from({ length: trendDays }, (_, index) => isoDateDaysAgo(trendDays - 1 - index));

    getChecklistHistorySummary({ storeIds, startDate: trendStartDate, endDate: today })
      .then((trendSummary) => {
        if (!active) return;
        const trendTotalsByDate = new Map<string, { totalTasks: number; completedTasks: number }>();
        trendSummary.forEach((row) => {
          const existing = trendTotalsByDate.get(row.date) ?? { totalTasks: 0, completedTasks: 0 };
          existing.totalTasks += row.totalTasks;
          existing.completedTasks += row.completedTasks;
          trendTotalsByDate.set(row.date, existing);
        });
        setTrend(
          trendDates.map((date) => {
            const totals = trendTotalsByDate.get(date) ?? { totalTasks: 0, completedTasks: 0 };
            return { day: formatDayLabel(date, trendDays), completion: completionPercent(totals.totalTasks, totals.completedTasks) };
          }),
        );
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      });

    return () => {
      active = false;
    };
  }, [storesLoading, stores, trendDays, retryTick]);

  // Fetch open issue count for the stat tile indicator
  useEffect(() => {
    const storeId = stores[0]?.id;
    if (!storeId) return;
    getIssues(storeId)
      .then(setIssues)
      .catch(() => {});
  }, [stores]);

  const storeName = stores[0]?.name ?? null;
  const todayTotals = useMemo(() => sumTasks(todayRows), [todayRows]);
  const todayCompletion = useMemo(
    () => completionPercent(todayTotals.totalTasks, todayTotals.completedTasks),
    [todayTotals],
  );

  // Each employee's share of today's total store tasks (not "% of tasks
  // assigned to them" -- checklists are store-wide, not per-employee, so this
  // reads as "how much of today's checklist did this person personally carry").
  const employeeContributions = useMemo(
    () =>
      employeeTaskCounts
        .map((employee) => ({
          id: employee.id,
          name: employee.name,
          avatarUrl: employee.avatarUrl,
          taskCount: employee.taskCount,
          percent: completionPercent(todayTotals.totalTasks, employee.taskCount),
        }))
        .sort((a, b) => b.percent - a.percent),
    [employeeTaskCounts, todayTotals],
  );

  // Worst-first: the category most in need of attention leads the list,
  // mirroring how the trend/donut cards already frame "today" as a health
  // check rather than a neutral tally.
  const categoryHealth = useMemo(
    () =>
      categoryBreakdown
        .map((category) => ({
          id: category.id,
          name: category.name,
          percent: completionPercent(category.total, category.completed),
        }))
        .sort((a, b) => a.percent - b.percent),
    [categoryBreakdown],
  );

  const completionDonutData = useMemo(
    () => [
      { name: 'Completed', value: todayCompletion },
      { name: 'Remaining', value: Math.max(0, 100 - todayCompletion) },
    ],
    [todayCompletion],
  );

  const issuesLoading = issues === null;
  const openIssueCount = issues ? issues.filter((i) => i.status === 'OPEN').length : 0;
  const hasOpenIssues = openIssueCount > 0;

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    [],
  );

  return (
    <div className="home-page">
      <div className="home-page__heading-row">
        <h1 className="home-page__greeting">Welcome, {firstName(userName)}!</h1>
        <span className="home-page__date">
          <Calendar size={13} aria-hidden="true" />
          {todayLabel}
        </span>
      </div>

      {loadError && (
        <div className="home-page__error">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{loadError}</span>
          <button type="button" className="btn btn--secondary" onClick={() => setRetryTick((t) => t + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="stat-card-row">
        <StatCard
          icon={Users}
          label="Total Employees"
          value={employees.length}
          tone="info"
          onClick={onViewEmployees}
        />
        <StatCard
          icon={Tags}
          label="Categories"
          value={categories.length}
          tone="success"
          onClick={onViewCategories}
        />
        <StatCard
          icon={ListChecks}
          label="Today's Completion"
          value={`${todayTotals.completedTasks}/${todayTotals.totalTasks}`}
          tone="warning"
          onClick={onViewStoreDetail}
        />
        {issuesLoading ? (
          <StatCard icon={AlertTriangle} label="Open Issues" value="—" tone="info" />
        ) : (
          <StatCard
            icon={hasOpenIssues ? AlertTriangle : CheckCircle2}
            label="Open Issues"
            value={hasOpenIssues ? openIssueCount : 'All clear'}
            tone={hasOpenIssues ? 'primary' : 'success'}
            onClick={onViewIssues}
          />
        )}
      </div>

      {storeName && <p className="home-page__store-label">{storeName}</p>}

      <div className="chart-card-row chart-card-row--top">
        <CompletionRateCard
          trend={trend}
          periodDays={trendDays}
          onPeriodChange={setTrendDays}
          todayCompletion={todayCompletion}
        />

        <ChartCard title="Today's Completion" subtitle="Share of tasks completed on time, today" height={300}>
          <div className="home-page__donut-card">
            <div className="home-page__donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completionDonutData}
                    dataKey="value"
                    innerRadius="70%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    <Cell fill="var(--color-accent)" />
                    <Cell fill="var(--color-border)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="home-page__donut-label">
                <span className="home-page__donut-value">{todayCompletion}%</span>
                <span className="home-page__donut-caption">on time</span>
              </div>
            </div>
            <div className="home-page__donut-legend">
              <div className="home-page__donut-legend-item">
                <span className="home-page__donut-legend-heading">
                  <span className="home-page__donut-legend-dot home-page__donut-legend-dot--completed" />
                  Completed
                </span>
                <span className="home-page__donut-legend-value">{todayTotals.completedTasks} tasks</span>
              </div>
              <div className="home-page__donut-legend-item">
                <span className="home-page__donut-legend-heading">
                  <span className="home-page__donut-legend-dot home-page__donut-legend-dot--pending" />
                  Pending
                </span>
                <span className="home-page__donut-legend-value">
                  {todayTotals.totalTasks - todayTotals.completedTasks} tasks
                </span>
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Category Health"
          subtitle="Completion rate by store category today"
          height={300}
          headerRight={
            <div className="home-page__category-health-target">
              <span>Target</span>
              <span className="home-page__category-health-target-value">100%</span>
            </div>
          }
        >
          <div className="home-page__category-health">
            <div className="home-page__category-health-rows">
              {categoryHealth.map((category) => {
                const tier = category.percent >= 90 ? 'good' : category.percent >= 50 ? 'warning' : 'risk';
                return (
                  <div key={category.id} className="home-page__category-health-row">
                    <div className="home-page__category-health-row-top">
                      <span className="home-page__category-health-name">
                        <span className="home-page__category-health-dot" data-tier={tier} />
                        {category.name}
                      </span>
                      <span className="home-page__category-health-percent" data-tier={tier}>
                        {category.percent}%
                      </span>
                    </div>
                    <div className="home-page__category-health-bar-track">
                      <div
                        className="home-page__category-health-bar-fill"
                        style={{ width: `${category.percent}%` }}
                        data-tier={tier}
                      />
                    </div>
                  </div>
                );
              })}
              {categoryHealth.length === 0 && (
                <p className="home-page__category-health-empty">No categories scheduled today.</p>
              )}
            </div>
            <div className="home-page__category-health-footer">
              <button
                type="button"
                className="home-page__category-health-link"
                onClick={() => onViewStoreDetail()}
              >
                View Full Daily Checklist
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="chart-card-row">
        <ChartCard
          title="Today's Contributions"
          subtitle="Share of today's tasks completed individually by active staff"
          height={300}
          headerRight={
            <span className="home-page__contribution-count-badge">
              {employeeContributions.length} member{employeeContributions.length === 1 ? '' : 's'} logged
            </span>
          }
        >
          <div className="home-page__contribution">
            <div className="home-page__contribution-rows">
              {employeeContributions.map((employee, index) => (
                <div key={employee.id} className="home-page__contribution-row">
                  {employee.avatarUrl ? (
                    <img
                      className="home-page__contribution-avatar home-page__contribution-avatar--img"
                      src={employee.avatarUrl}
                      alt=""
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="home-page__contribution-avatar"
                      style={{ background: CONTRIBUTOR_AVATAR_COLORS[index % CONTRIBUTOR_AVATAR_COLORS.length] }}
                    >
                      {getInitials(employee.name)}
                    </span>
                  )}
                  <div className="home-page__contribution-info">
                    <span className="home-page__contribution-name">{employee.name}</span>
                    <span className="home-page__contribution-meta">
                      {employee.taskCount} task{employee.taskCount === 1 ? '' : 's'} completed
                    </span>
                  </div>
                  <div className="home-page__contribution-bar-track">
                    <div
                      className="home-page__contribution-bar-fill"
                      style={{ width: `${employee.percent}%` }}
                    />
                  </div>
                  <span className="home-page__contribution-percent">{employee.percent}%</span>
                </div>
              ))}
              {employeeContributions.length === 0 && (
                <p className="home-page__contribution-empty">No responses submitted yet today.</p>
              )}
            </div>
          </div>
        </ChartCard>

        <RecentActivityCard onViewAll={onViewStoreDetail} />
      </div>

      {isLoading && <p className="home-page__loading">Loading dashboard…</p>}

    </div>
  );
}

export default Home;
