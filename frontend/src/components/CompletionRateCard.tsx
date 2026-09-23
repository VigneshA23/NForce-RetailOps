import { useId } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from 'recharts';
import Select from './Select';
import './CompletionRateCard.css';

interface TrendPoint {
  day: string;
  completion: number;
}

interface CompletionRateCardProps {
  title?: string;
  trend: TrendPoint[];
  periodDays: number;
  onPeriodChange: (days: number) => void;
  todayCompletion: number;
  // Lets a caller fit this card into a shorter fixed-height slot (e.g. Super
  // Admin's dashboard row, which must match its Platform Health/Recent
  // Activity siblings) without changing Home.tsx's own look.
  chartHeight?: number;
  // Pins a permanent callout on the most recent point (today), so its value
  // is visible without hovering -- opt-in so Home.tsx's own card is unaffected.
  highlightLatestPoint?: boolean;
}

// Custom ReferenceLine label: a small dark rounded callout (value + day),
// matching the hover tooltip's own look, anchored near the top of the chart
// and connected down to the actual point by the reference line itself.
function LatestPointCallout({ viewBox, value, day }: { viewBox?: { x?: number; y?: number }; value: number; day: string }) {
  if (!viewBox || viewBox.x == null || viewBox.y == null) return null;
  const boxWidth = 56;
  const boxHeight = 36;
  const x = viewBox.x;
  const y = viewBox.y + 6;
  return (
    <g>
      <rect x={x - boxWidth / 2} y={y} width={boxWidth} height={boxHeight} rx={8} fill="#0d0d0f" />
      <text x={x} y={y + 16} textAnchor="middle" fill="#ffffff" fontSize={12} fontWeight={700}>{value}%</text>
      <text x={x} y={y + 29} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10}>{day}</text>
    </g>
  );
}

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '14', label: 'Last 14 Days' },
  { value: '30', label: 'Last 30 Days' },
];

function RateTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="completion-rate-card__tooltip">
      <span className="completion-rate-card__tooltip-value">{payload[0].value}%</span>
      <span className="completion-rate-card__tooltip-label">{label}</span>
    </div>
  );
}

function CompletionRateCard({
  title = 'Completion Rate', trend, periodDays, onPeriodChange, todayCompletion, chartHeight = 220,
  highlightLatestPoint = false,
}: CompletionRateCardProps) {
  const gradientId = useId();
  const firstPoint = trend[0];
  const lastPoint = trend[trend.length - 1];
  const delta = firstPoint ? todayCompletion - firstPoint.completion : 0;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return (
    <div className="card completion-rate-card">
      <div className="card__header">
        <h3 className="card__title">{title}</h3>
        <Select
          className="completion-rate-card__period"
          options={PERIOD_OPTIONS}
          value={String(periodDays)}
          onChange={(value) => onPeriodChange(Number(value))}
          ariaLabel="Select time period"
          align="right"
        />
      </div>

      <div className="completion-rate-card__headline">
        <span className="completion-rate-card__value">{todayCompletion}%</span>
        {firstPoint && (
          <span className={`completion-rate-card__badge completion-rate-card__badge--${direction}`}>
            {direction === 'up' ? <ArrowUp size={12} /> : direction === 'down' ? <ArrowDown size={12} /> : <Minus size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {firstPoint && (
        <p className="completion-rate-card__subtext">
          {direction === 'flat' ? 'No change' : `${direction === 'up' ? '+' : '-'}${Math.abs(delta)}%`} since {firstPoint.day}
        </p>
      )}

      <div className="completion-rate-card__chart" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--color-text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval={periodDays <= 7 ? 0 : 'preserveStartEnd'}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={44} unit="%" />
            <Tooltip content={<RateTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="completion"
              name="Completion %"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
            {highlightLatestPoint && lastPoint && (
              <>
                <ReferenceLine
                  x={lastPoint.day}
                  stroke="var(--color-border)"
                  strokeDasharray="4 4"
                  label={(props: { viewBox?: { x?: number; y?: number } }) => (
                    <LatestPointCallout viewBox={props.viewBox} value={todayCompletion} day={lastPoint.day} />
                  )}
                />
                <ReferenceDot
                  x={lastPoint.day}
                  y={lastPoint.completion}
                  r={4}
                  fill="var(--color-accent)"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default CompletionRateCard;
