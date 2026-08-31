import { useEffect, useMemo, useState } from 'react';
import { Store as StoreIcon, Users, Tags, CircleCheck, Percent } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getStores } from '../api/ownerStores';
import { getEmployees } from '../api/employees';
import { getCategories } from '../api/categories';
import { getShiftHistory } from '../api/history';
import type { OwnerStore } from '../types/ownerStore';
import type { Employee } from '../types/employee';
import type { Category } from '../types/category';
import type { ShiftHistory } from '../types/history';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import './Home.css';

const TREND_DAYS = 7;

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

function averageOnTimePercent(histories: ShiftHistory[]): number {
  if (histories.length === 0) return 0;
  return Math.round(histories.reduce((sum, history) => sum + history.summary.onTimePercent, 0) / histories.length);
}

function Home() {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [todayHistories, setTodayHistories] = useState<ShiftHistory[]>([]);
  const [trend, setTrend] = useState<{ day: string; completion: number }[]>([]);
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

        const [todayResults, trendResults] = await Promise.all([
          Promise.all(storeIds.map((id) => getShiftHistory(id, isoDateDaysAgo(0)))),
          Promise.all(
            Array.from({ length: TREND_DAYS }, (_, index) => TREND_DAYS - 1 - index).map(async (daysAgo) => {
              const date = isoDateDaysAgo(daysAgo);
              const histories = await Promise.all(storeIds.map((id) => getShiftHistory(id, date)));
              return { day: formatDayLabel(date), completion: averageOnTimePercent(histories) };
            }),
          ),
        ]);

        if (!active) return;
        setTodayHistories(todayResults);
        setTrend(trendResults);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeStoreCount = useMemo(() => stores.filter((store) => store.active).length, [stores]);
  const todayCompletion = useMemo(() => averageOnTimePercent(todayHistories), [todayHistories]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, { name: string; completed: number; total: number }>();
    todayHistories.forEach((history) => {
      history.categories.forEach((category) => {
        const existing = totals.get(category.id) ?? { name: category.name, completed: 0, total: 0 };
        existing.completed += category.tasksCompleted;
        existing.total += category.tasksTotal;
        totals.set(category.id, existing);
      });
    });
    return Array.from(totals.values());
  }, [todayHistories]);

  return (
    <div className="home-page">
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
      </div>

      {isLoading && <p className="home-page__loading">Loading dashboard…</p>}
    </div>
  );
}

export default Home;
