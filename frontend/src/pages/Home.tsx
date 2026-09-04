import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Users, Tags, Percent } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getChecklistHistoryDetail, getChecklistHistorySummary } from '../api/checklistHistory';
import type { OwnerStore } from '../types/ownerStore';
import type { Employee } from '../types/employee';
import type { Category } from '../types/category';
import type { ChecklistHistorySummaryRow } from '../types/checklistHistory';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import './Home.css';

interface HomeProps {
  userName: string;
  stores: OwnerStore[];
  storesLoading: boolean;
  employees: Employee[];
  categories: Category[];
  onViewStoreDetail: () => void;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

const TREND_DAYS = 7;

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
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

function Home({ userName, stores, storesLoading, employees, categories, onViewStoreDetail }: HomeProps) {
  const [todayRows, setTodayRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [trend, setTrend] = useState<{ day: string; completion: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ id: number; name: string; completed: number; total: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (storesLoading) return;
    let active = true;
    setIsLoading(true);

    const storeIds = stores.map((store) => store.id);

    (async () => {
      if (storeIds.length === 0) {
        if (active) {
          setTodayRows([]);
          setTrend([]);
          setCategoryBreakdown([]);
        }
        return;
      }

      const today = isoDateDaysAgo(0);
      const trendStartDate = isoDateDaysAgo(TREND_DAYS - 1);

      const [todaySummary, trendSummary, details] = await Promise.all([
        getChecklistHistorySummary({ storeIds, startDate: today, endDate: today }),
        getChecklistHistorySummary({ storeIds, startDate: trendStartDate, endDate: today }),
        Promise.all(storeIds.map((id) => getChecklistHistoryDetail(id, today))),
      ]);

      if (!active) return;
      setTodayRows(todaySummary);

      const trendTotalsByDate = new Map<string, { totalTasks: number; completedTasks: number }>();
      trendSummary.forEach((row) => {
        const existing = trendTotalsByDate.get(row.date) ?? { totalTasks: 0, completedTasks: 0 };
        existing.totalTasks += row.totalTasks;
        existing.completedTasks += row.completedTasks;
        trendTotalsByDate.set(row.date, existing);
      });
      setTrend(
        Array.from({ length: TREND_DAYS }, (_, index) => isoDateDaysAgo(TREND_DAYS - 1 - index)).map((date) => {
          const totals = trendTotalsByDate.get(date) ?? { totalTasks: 0, completedTasks: 0 };
          return { day: formatDayLabel(date), completion: completionPercent(totals.totalTasks, totals.completedTasks) };
        }),
      );

      const categoryTotals = new Map<number, { name: string; completed: number; total: number }>();
      details.forEach((detail) => {
        detail.categories.forEach((category) => {
          const existing = categoryTotals.get(category.id) ?? { name: category.name, completed: 0, total: 0 };
          existing.total += category.tasks.length;
          existing.completed += category.tasks.filter((task) => task.completed).length;
          categoryTotals.set(category.id, existing);
        });
      });
      setCategoryBreakdown(
        Array.from(categoryTotals.entries()).map(([id, totals]) => ({ id, ...totals })),
      );
    })().finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [storesLoading, stores]);

  const storeName = stores[0]?.name ?? null;
  const todayCompletion = useMemo(() => {
    const totals = sumTasks(todayRows);
    return completionPercent(totals.totalTasks, totals.completedTasks);
  }, [todayRows]);

  const storeToday = useMemo(() => todayRows[0] ?? null, [todayRows]);
  const storeTodayCompletion = storeToday
    ? completionPercent(storeToday.totalTasks, storeToday.completedTasks)
    : todayCompletion;

  const completionDonutData = useMemo(
    () => [
      { name: 'Completed', value: todayCompletion },
      { name: 'Remaining', value: Math.max(0, 100 - todayCompletion) },
    ],
    [todayCompletion],
  );

  return (
    <div className="home-page">
      <h1 className="home-page__greeting">Welcome, {firstName(userName)}!</h1>

      <div className="stat-card-row">
        <StatCard icon={Users} label="Total Employees" value={employees.length} tone="info" />
        <StatCard icon={Tags} label="Categories" value={categories.length} tone="info" />
        <StatCard icon={Percent} label="Today's Completion" value={`${todayCompletion}%`} tone="warning" />
      </div>
      {storeName && <p className="home-page__store-label">{storeName}</p>}

      <div className="chart-card-row">
        <ChartCard title="Completion Rate" subtitle={`Last ${TREND_DAYS} days across all stores`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={36}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <Line
                type="monotone"
                dataKey="completion"
                name="Completion %"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasks by Category" subtitle="Completed vs. total, today">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <Bar dataKey="completed" name="Completed" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="total" name="Total" fill="var(--color-border)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Today's Completion" subtitle="Share of tasks completed on time, today">
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
        </ChartCard>

        <ChartCard title="Store Today" subtitle="On-time completion for your store">
          <div className="home-page__store-status">
            {storeName && <p className="home-page__store-status-name">{storeName}</p>}
            <div className="home-page__store-status-percent">{storeTodayCompletion}%</div>
            <div className="home-page__store-status-bar-track">
              <div
                className="home-page__store-status-bar-fill"
                style={{ width: `${storeTodayCompletion}%` }}
              />
            </div>
            <button
              type="button"
              className="home-page__store-rank-details"
              onClick={() => onViewStoreDetail()}
            >
              View Daily Checklist
              <ChevronRight size={14} />
            </button>
          </div>
        </ChartCard>
      </div>

      {isLoading && <p className="home-page__loading">Loading dashboard…</p>}
    </div>
  );
}

export default Home;
