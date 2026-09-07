import { useEffect, useState, type FormEvent } from 'react';
import { Flag } from 'lucide-react';
import { flagResponse } from '../api/checklistHistory';
import type { ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';
import Modal from './Modal';

interface FlagResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  responseEntry: ChecklistHistoryResponseEntry;
  task: ChecklistHistoryTaskItem;
  onFlagged: (updatedResponse: ChecklistHistoryResponseEntry) => void;
}

function FlagResponseModal({ isOpen, onClose, responseEntry, task, onFlagged }: FlagResponseModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setError(null);
  }, [isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const updated = await flagResponse(responseEntry.id, trimmed);
      onFlagged(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flag response');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Flag Back to Employee"
      subtitle={`${task.name} · ${responseEntry.employeeFullName}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="flag-response-form"
            className="btn btn--warning"
            disabled={submitting || !reason.trim()}
          >
            <Flag size={14} />
            {submitting ? 'Flagging…' : 'Flag for Correction'}
          </button>
        </>
      }
    >
      <form id="flag-response-form" onSubmit={handleSubmit}>
        <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          The employee will see this reason and must re-submit their response. Their original response is preserved in history.
        </p>
        <div className="correction-modal__field">
          <label className="correction-modal__label">
            Reason for correction <span className="correction-modal__required">*</span>
          </label>
          <textarea
            className="correction-modal__textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What does the employee need to fix or redo?"
            rows={4}
            maxLength={500}
            required
            autoFocus
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {reason.length}/500
          </span>
        </div>
        {error && <p className="correction-modal__error">{error}</p>}
      </form>
    </Modal>
  );
}

export default FlagResponseModal;
