import type { LucideIcon } from 'lucide-react';
import './GradientKpiTile.css';

interface GradientKpiTileProps {
  icon: LucideIcon;
  label: string;
  value: number;
  caption?: string;
  color: string;
  tint: string;
  iconBg: string;
  active?: boolean;
  onClick?: () => void;
}

// The Orders-redesign KPI tile: a gradient wash toward a tint color, a 4px
// color bar down the left edge, and an icon in a matching tinted circle --
// distinct from the flatter, app-wide StatCard used elsewhere.
function GradientKpiTile({ icon: Icon, label, value, caption, color, tint, iconBg, active, onClick }: GradientKpiTileProps) {
  return (
    <button
      type="button"
      className={`gradient-kpi-tile${active ? ' gradient-kpi-tile--active' : ''}`}
      aria-pressed={onClick ? active ?? false : undefined}
      onClick={onClick}
      disabled={!onClick}
      style={{
        background: `linear-gradient(100deg, #ffffff 0%, ${tint} 100%)`,
        borderColor: active ? color : '#e4e4e7',
      }}
    >
      <span className="gradient-kpi-tile__bar" style={{ background: color }} aria-hidden="true" />
      <span className="gradient-kpi-tile__body">
        <span className="gradient-kpi-tile__label">{label}</span>
        <span className="gradient-kpi-tile__value">{value}</span>
        {caption && <span className="gradient-kpi-tile__caption">{caption}</span>}
      </span>
      <span className="gradient-kpi-tile__icon" style={{ color, background: iconBg }}>
        <Icon size={22} />
      </span>
    </button>
  );
}

export default GradientKpiTile;
