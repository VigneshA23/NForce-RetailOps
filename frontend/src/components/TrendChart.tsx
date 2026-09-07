import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TrendDataPoint } from '../api/superAdminOperations';
import './TrendChart.css';

interface TrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
  height?: number;
  compact?: boolean;
}

function formatLabel(date: string, compact: boolean): string {
  const d = new Date(date + 'T12:00:00');
  if (compact) {
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TrendChart({ data, loading = false, height = 180, compact = false }: TrendChartProps) {
  if (loading) {
    return (
      <div className="trend-chart__skeleton" style={{ height }}>
        <div className="trend-chart__skeleton-bar" />
      </div>
    );
  }

  const allZero = data.every((d) => d.completionPercent === 0);

  if (data.length === 0) {
    return (
      <div className="trend-chart__empty" style={{ height }}>
        No data yet
      </div>
    );
  }

  const tickCount = data.length <= 7 ? data.length : compact ? 4 : 7;
  const interval = Math.max(0, Math.floor(data.length / tickCount) - 1);

  return (
    <div className="trend-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatLabel(v, compact)}
            tick={{ fontSize: compact ? 10 : 11, fill: 'var(--color-text-tertiary)' }}
            interval={interval}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: compact ? 10 : 11, fill: 'var(--color-text-tertiary)' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => [`${value}%`, 'Completion']}
            labelFormatter={(label: string) => formatLabel(label, false)}
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: '0.8125rem',
              color: 'var(--color-text-primary)',
            }}
            itemStyle={{ color: 'var(--color-primary)' }}
          />
          <Line
            type="monotone"
            dataKey="completionPercent"
            stroke={allZero ? 'var(--color-text-tertiary)' : 'var(--color-primary)'}
            strokeWidth={compact ? 1.5 : 2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TrendChart;
