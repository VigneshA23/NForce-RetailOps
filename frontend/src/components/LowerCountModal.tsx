import { useEffect, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';

interface LowerCountModalProps {
  isOpen: boolean;
  itemName: string;
  unit: string;
  // Usable stock counted now, and what Start of Day was expected to be.
  countedUsable: number;
  expectedUsable: number;
  previousByName: string | null;
  isSubmitting?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

// Shown when a Start of Day count is below the last End of Day. Stock should
// never fall overnight without an explanation, so the employee gives a reason
// and the count goes to the admin for approval.
function LowerCountModal({
  isOpen,
  itemName,
  unit,
  countedUsable,
  expectedUsable,
  previousByName,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: LowerCountModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Give a reason for the lower count');
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      centered
      title="Start of Day is lower than End of Day"
      subtitle={`${itemName}: you counted ${countedUsable} ${unit}, but the last End of Day${previousByName ? ` (submitted by ${previousByName})` : ''} leaves ${expectedUsable} ${unit}. Check your count, or give a reason and request your admin's approval.`}
      footer={
        <>
          <button type="button" className="btn btn--secondary" disabled={isSubmitting} onClick={onCancel}>
            Recount
          </button>
          <button type="submit" form="lower-count-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Request approval'}
          </button>
        </>
      }
    >
      <form id="lower-count-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Reason" htmlFor="lower-count-reason" error={error ?? undefined}>
          <textarea
            id="lower-count-reason"
            className="input"
            rows={3}
            maxLength={500}
            value={reason}
            autoFocus
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
          />
        </FormField>
      </form>
    </Modal>
  );
}

export default LowerCountModal;
