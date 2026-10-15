import { useState } from 'react';
import { Info } from 'lucide-react';
import Modal from './Modal';
import { useIsMobile } from '../hooks/useMediaQuery';
import './EndOfDaySkippedBadge.css';

interface EndOfDaySkippedBadgeProps {
  // Why nobody counted End of Day, as typed when it was marked not countable.
  reason: string | null | undefined;
  byName?: string | null;
  // Defaults to the same outline badge as the other "not counted" states.
  className?: string;
}

// "EOD Not Counted" with an info icon carrying the reason: shown on hover or
// keyboard focus on desktop, and as a popup when tapped on mobile (where
// there is no hover).
function EndOfDaySkippedBadge({ reason, byName, className = 'badge badge--outline' }: EndOfDaySkippedBadgeProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const message = reason?.trim() || 'No reason was recorded.';

  return (
    <>
      <span className={`${className} eod-skipped`}>
        EOD Not Counted
        <button
          type="button"
          className="eod-skipped__icon"
          aria-label="Why End of Day was not counted"
          onClick={() => { if (isMobile) setOpen(true); }}
        >
          <Info size={13} aria-hidden="true" />
          {!isMobile && (
            <span className="eod-skipped__tip" role="tooltip">
              {message}
              {byName ? <em> — {byName}</em> : null}
            </span>
          )}
        </button>
      </span>
      {isMobile && (
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          centered
          title="End of Day not counted"
          subtitle={byName ? `Explained by ${byName}` : undefined}
          footer={<button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Close</button>}
        >
          <p className="eod-skipped__message">{message}</p>
        </Modal>
      )}
    </>
  );
}

export default EndOfDaySkippedBadge;
