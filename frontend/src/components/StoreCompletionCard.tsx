import { ArrowUpRight } from 'lucide-react';
import DashRingChart, { type DashRingSegment } from './DashRingChart';
import StoreFilterDropdown, { type StoreFilterOption } from './StoreFilterDropdown';
import './StoreCompletionCard.css';

interface StoreCompletionCardProps {
  options: StoreFilterOption[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  completedCount: number;
  inProgressCount: number;
  unscheduledCount: number;
  completionPercent: number;
  // Shown as a "View Store" shortcut, only meaningful once the dropdown has
  // narrowed the selection down to exactly one store.
  onViewStore?: () => void;
}

function StoreCompletionCard({
  options,
  selectedIds,
  onSelectionChange,
  completedCount,
  inProgressCount,
  unscheduledCount,
  completionPercent,
  onViewStore,
}: StoreCompletionCardProps) {
  const total = completedCount + inProgressCount + unscheduledCount;
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));
  const segments: DashRingSegment[] = [
    { key: 'completed', label: 'Completed', percent: pct(completedCount), color: 'var(--color-status-completed)' },
    { key: 'in-progress', label: 'In Progress', percent: pct(inProgressCount), color: 'var(--color-status-in-progress)' },
    { key: 'unscheduled', label: 'Unscheduled', percent: pct(unscheduledCount), color: 'var(--color-status-unscheduled)' },
  ];

  return (
    <div className="card store-completion-card">
      <div className="card__header">
        <h3 className="card__title">Stores by Completion</h3>
        <div className="card__toolbar">
          {onViewStore && (
            <button
              type="button"
              className="store-completion-card__icon-btn"
              onClick={onViewStore}
              aria-label="View store details"
              title="View store details"
            >
              <ArrowUpRight size={14} />
            </button>
          )}
          <StoreFilterDropdown options={options} selectedIds={selectedIds} onChange={onSelectionChange} />
        </div>
      </div>

      {total === 0 ? (
        <p className="store-completion-card__empty">No stores to show.</p>
      ) : (
        <div className="store-completion-card__body">
          <DashRingChart segments={segments} size={176}>
            <span className="store-completion-card__ring-value">{completionPercent}%</span>
            <span className="store-completion-card__ring-caption">Completion</span>
          </DashRingChart>

          <ul className="store-completion-card__legend">
            <li className="store-completion-card__legend-row">
              <span className="store-completion-card__legend-dot store-completion-card__legend-dot--completed" />
              <span className="store-completion-card__legend-label">Completed</span>
              <span className="store-completion-card__legend-value">{completedCount}</span>
            </li>
            <li className="store-completion-card__legend-row">
              <span className="store-completion-card__legend-dot store-completion-card__legend-dot--in-progress" />
              <span className="store-completion-card__legend-label">In Progress</span>
              <span className="store-completion-card__legend-value">{inProgressCount}</span>
            </li>
            <li className="store-completion-card__legend-row">
              <span className="store-completion-card__legend-dot store-completion-card__legend-dot--unscheduled" />
              <span className="store-completion-card__legend-label">Unscheduled</span>
              <span className="store-completion-card__legend-value">{unscheduledCount}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default StoreCompletionCard;
