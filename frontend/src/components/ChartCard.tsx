import type { ReactNode } from 'react';
import './ChartCard.css';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  height?: number;
  children: ReactNode;
}

function ChartCard({ title, subtitle, height = 260, children }: ChartCardProps) {
  return (
    <div className="card chart-card">
      <div className="chart-card__header">
        <h3 className="chart-card__title">{title}</h3>
        {subtitle && <p className="chart-card__subtitle">{subtitle}</p>}
      </div>
      <div className="chart-card__body" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export default ChartCard;
