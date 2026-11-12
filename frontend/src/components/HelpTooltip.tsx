import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import Modal from './Modal';
import { isTouchDevice } from '../utils/autoFocus';
import './HelpTooltip.css';

interface HelpTooltipProps {
  label: string;
  description: string;
}

function HelpTooltip({ label, description }: HelpTooltipProps) {
  const isTouch = isTouchDevice();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="help-tooltip"
        aria-label={`Help for ${label}`}
        aria-haspopup={isTouch ? 'dialog' : undefined}
        onClick={() => { if (isTouch) setOpen(true); }}
      >
        <CircleHelp size={15} aria-hidden="true" />
        {!isTouch && <span className="help-tooltip__content" role="tooltip">{description}</span>}
      </button>
      {isTouch && (
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          centered
          title={label}
          titleIcon={<CircleHelp size={18} />}
          footer={<button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Close</button>}
        >
          <p className="help-tooltip__message">{description}</p>
        </Modal>
      )}
    </>
  );
}

export default HelpTooltip;
