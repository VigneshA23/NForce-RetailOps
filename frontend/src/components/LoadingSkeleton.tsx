import { useEffect, useState } from 'react';
import './LoadingSkeleton.css';

interface LoadingSkeletonProps {
  // Announced to screen readers straight away (and kept for tests/queries).
  label: string;
  // 'table' = rows of bars, 'list' = icon + two lines, 'block' = one panel.
  variant?: 'table' | 'list' | 'block';
  rows?: number;
  // Fast responses never flash a skeleton: it only paints after this delay.
  delayMs?: number;
}

// Placeholder shown while an API call is in flight. Mounted only while the
// request is pending, so the delay timer starts when loading starts and the
// skeleton never appears for responses that come back quickly.
function LoadingSkeleton({ label, variant = 'table', rows = 5, delayMs = 250 }: LoadingSkeletonProps) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return undefined;
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return (
    <div className="loading-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="loading-skeleton__label">{label}</span>
      {visible && (
        <div className="loading-skeleton__shapes" aria-hidden="true">
          {variant === 'block' && <span className="loading-skeleton__bar loading-skeleton__bar--block" />}
          {variant === 'table' &&
            Array.from({ length: rows }, (_, i) => (
              <div key={i} className="loading-skeleton__row">
                <span className="loading-skeleton__bar" style={{ width: '24%' }} />
                <span className="loading-skeleton__bar" style={{ width: '32%' }} />
                <span className="loading-skeleton__bar" style={{ width: '16%' }} />
                <span className="loading-skeleton__bar" style={{ width: '10%' }} />
              </div>
            ))}
          {variant === 'list' &&
            Array.from({ length: rows }, (_, i) => (
              <div key={i} className="loading-skeleton__item">
                <span className="loading-skeleton__bar loading-skeleton__bar--icon" />
                <div className="loading-skeleton__lines">
                  <span className="loading-skeleton__bar" style={{ width: '45%', height: 12 }} />
                  <span className="loading-skeleton__bar" style={{ width: '75%', height: 10 }} />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default LoadingSkeleton;
