import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Store as StoreIcon, Users, Tags, CircleCheck, Percent } from 'lucide-react';
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
import { getStores } from '../api/ownerStores';
import { getEmployees } from '../api/employees';
import { getCategories } from '../api/categories';
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
  onViewStoreDetail: (storeId: number) => void;
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

function Home({ userName, onViewStoreDetail }: HomeProps) {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [todayRows, setTodayRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [trend, setTrend] = useState<{ day: string; completion: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ id: number; name: string; completed: number; total: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([getStores(), getEmployees(), getCategories()])
      .then(async ([storeList, employeeList, categoryList]) => {
        if (!active) return;
        setStores(storeList);
        setEmployees(employeeList);
        setCategories(categoryList);

        const storeIds = storeList.map((store) => store.id);
        if (storeIds.length === 0) {
          setTodayRows([]);
          setTrend([]);
          setCategoryBreakdown([]);
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
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeStoreCount = useMemo(() => stores.filter((store) => store.active).length, [stores]);
  const todayCompletion = useMemo(() => {
    const totals = sumTasks(todayRows);
    return completionPercent(totals.totalTasks, totals.completedTasks);
  }, [todayRows]);

  const completionByStore = useMemo(
    () =>
      todayRows
        .map((row) => ({
          id: row.storeId,
          name: row.storeName,
          completion: completionPercent(row.totalTasks, row.completedTasks),
        }))
        .sort((a, b) => b.completion - a.completion),
    [todayRows],
  );

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
        <StatCard icon={StoreIcon} label="Total Stores" value={stores.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active Stores" value={activeStoreCount} tone="success" />
        <StatCard icon={Users} label="Total Employees" value={employees.length} tone="info" />
        <StatCard icon={Tags} label="Categories" value={categories.length} tone="info" />
        <StatCard icon={Percent} label="Today's Completion" value={`${todayCompletion}%`} tone="warning" />
      </div>

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

        <ChartCard title="Stores by Completion" subtitle="Ranked by today's on-time completion">
          {completionByStore.length === 0 ? (
            <p className="home-page__empty">No store activity recorded yet today.</p>
          ) : (
            <ul className="home-page__store-rank">
              {completionByStore.map((store) => (
                <li key={store.id} className="home-page__store-rank-row">
                  <span className="home-page__store-rank-name">{store.name}</span>
                  <div className="home-page__store-rank-bar-track">
                    <div
                      className="home-page__store-rank-bar-fill"
                      style={{ width: `${store.completion}%` }}
                    />
                  </div>
                  <span className="home-page__store-rank-value">{store.completion}%</span>
                  <button
                    type="button"
                    className="home-page__store-rank-details"
                    onClick={() => onViewStoreDetail(store.id)}
                  >
                    Details
                    <ChevronRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {isLoading && <p className="home-page__loading">Loading dashboard…</p>}
    </div>
  );
}

export default Home;
