import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './DashRingChart.css';

export interface DashRingSegment {
  key: string;
  label: string;
  percent: number;
  color: string;
}

interface DashRingChartProps {
  segments: DashRingSegment[];
  size?: number;
  dashCount?: number;
  children?: ReactNode;
}

const TRACK_COLOR = 'var(--color-border)';
const CENTER = 100;
const OUTER_RADIUS = 92;
const INNER_RADIUS = 66;

interface HoveredDash {
  label: string;
  percent: number;
  x: number;
  y: number;
}

// A ring made of many individual radial ticks rather than one smooth arc --
// each tick belongs to whichever segment its slot's midpoint falls into, so
// a 0%-value segment naturally gets zero ticks instead of needing to be
// filtered out (unlike a Pie slice, which still renders a visible sliver for
// a zero value once cornerRadius is involved).
function DashRingChart({ segments, size = 168, dashCount = 56, children }: DashRingChartProps) {
  const [hovered, setHovered] = useState<HoveredDash | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.percent, 0);

  const dashes = Array.from({ length: dashCount }, (_, index) => {
    const midPercent = ((index + 0.5) / dashCount) * 100;
    let cumulative = 0;
    let match: DashRingSegment | null = null;
    if (total > 0) {
      for (const segment of segments) {
        cumulative += segment.percent;
        if (midPercent < cumulative) {
          match = segment;
          break;
        }
      }
    }
    const angleDeg = -90 + ((index + 0.5) / dashCount) * 360;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      key: index,
      segment: match,
      x1: CENTER + INNER_RADIUS * Math.cos(rad),
      y1: CENTER + INNER_RADIUS * Math.sin(rad),
      x2: CENTER + OUTER_RADIUS * Math.cos(rad),
      y2: CENTER + OUTER_RADIUS * Math.sin(rad),
    };
  });

  function handleHover(event: ReactMouseEvent<SVGLineElement>, segment: DashRingSegment) {
    setHovered({ label: segment.label, percent: segment.percent, x: event.clientX, y: event.clientY });
  }

  return (
    <div className="dash-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="dash-ring__svg" aria-hidden="true">
        {dashes.map((dash) => (
          <line
            key={dash.key}
            x1={dash.x1}
            y1={dash.y1}
            x2={dash.x2}
            y2={dash.y2}
            stroke={dash.segment?.color ?? TRACK_COLOR}
            strokeWidth={5}
            strokeLinecap="round"
            onMouseEnter={dash.segment ? (event) => handleHover(event, dash.segment as DashRingSegment) : undefined}
            onMouseMove={dash.segment ? (event) => handleHover(event, dash.segment as DashRingSegment) : undefined}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      <div className="dash-ring__center">{children}</div>
      {hovered &&
        createPortal(
          <div className="dash-ring__tooltip" style={{ top: hovered.y, left: hovered.x + 14 }} role="tooltip">
            <span className="dash-ring__tooltip-label">{hovered.label}</span>
            <span className="dash-ring__tooltip-value">{hovered.percent}%</span>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default DashRingChart;
