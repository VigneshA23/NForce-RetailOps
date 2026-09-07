import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import './StatCard.css';

export type StatCardTone = 'primary' | 'success' | 'warning' | 'info';

interface StatCardTrend {
  value: string;
  direction: 'up' | 'down';
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: StatCardTone;
  trend?: StatCardTrend;
  onClick?: () => void;
  active?: boolean;
}

function StatCard({ icon: Icon, label, value, tone = 'primary', trend, onClick, active }: StatCardProps) {
  const className = `stat-card stat-card--${tone}${active ? ' stat-card--active' : ''}`;

  const inner = (
    <>
      <div className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__value">{value}</span>
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
