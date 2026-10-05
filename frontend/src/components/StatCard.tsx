import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import './StatCard.css';

export type StatCardTone = 'primary' | 'success' | 'warning' | 'info' | 'purple';

interface StatCardTrend {
  value: string;
  direction: 'up' | 'down';
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  // Appended after the value in smaller, muted text (e.g. value=40, unit="items" -> "40 items").
  unit?: string;
  // Short tone-colored line below the value (e.g. "In Stock & Ready").
  caption?: string;
  tone?: StatCardTone;
  trend?: StatCardTrend;
  onClick?: () => void;
  active?: boolean;
}

function StatCard({ icon: Icon, label, value, unit, caption, tone = 'primary', trend, onClick, active }: StatCardProps) {
  const className = `stat-card stat-card--${tone}${active ? ' stat-card--active' : ''}`;

  const inner = (
    <>
      <div className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__value">
          {value}
          {unit && <span className="stat-card__unit">{unit}</span>}
        </span>
        {caption && <span className={`stat-card__caption stat-card__caption--${tone}`}>{caption}</span>}
        {trend && (
          <span className={`stat-card__trend stat-card__trend--${trend.direction}`}>
            {trend.direction === 'up' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {trend.value}
          </span>
        )}
      </div>
      <span className={`stat-card__icon stat-card__icon--${tone}`}>
        <Icon size={22} />
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

export default StatCard;
