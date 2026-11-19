import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  editCashFlag,
  editSuperAdminCashFlag,
  flagCashEntry,
  flagSuperAdminCashEntry,
  removeCashFlag,
  removeSuperAdminCashFlag,
} from '../api/storeCash';
import type { CashFlag, DailyCashEntry } from '../types/storeCash';
import FormField from './FormField';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import ButtonDots from './ButtonDots';
import { nfToast } from '../utils/toast';
import './CashEntryFlagSection.css';

interface CashEntryFlagSectionProps {
  entry: DailyCashEntry;
  // Owner/Admin and Super Admin: may raise, edit and remove flags. An employee
  // sees the flag read-only.
  canManage: boolean;
  // Which API flags are sent to. A Super Admin names the store explicitly.
  scope?: 'owner' | 'super-admin';
  storeId?: number | null;
  // Super Admin raises a flag from a button beside Update Entry instead of
  // from here: the parent bumps this counter to open the flag popup.
  raiseRequest?: number;
  hideRaiseButton?: boolean;
  // Called with the refreshed entry after a flag change.
  onEntryChange: (entry: DailyCashEntry) => void;
}


function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function resolvedLine(flag: CashFlag): string {
  const by = flag.resolvedByName ?? 'someone';
  const when = flag.resolvedAt ? ` · ${formatWhen(flag.resolvedAt)}` : '';
  if (flag.resolution === 'EMPLOYEE_FIXED') return `Resolved: corrected by employee ${by}${when}`;
  if (flag.resolution === 'CORRECTED') return `Resolved: corrected by ${by}${when}`;
  return `Flag removed by ${by}${when}`;
}

// Status, the flag and its comment (RTS-556/557). An open flag shows who
// flagged it and when; once the employee fixes the entry it shows "Resolved"
// so the admin can accept it or flag it again.
function CashEntryFlagSection({
  entry,
  canManage,
  scope = 'owner',
  storeId = null,
  raiseRequest = 0,
  hideRaiseButton = false,
  onEntryChange,
}: CashEntryFlagSectionProps) {
  const [mode, setMode] = useState<'raise' | 'edit' | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const flag = entry.flag;
  const lastRaiseRequest = useRef(raiseRequest);

  useEffect(() => {
    if (raiseRequest === lastRaiseRequest.current) return;
    lastRaiseRequest.current = raiseRequest;
    if (!entry.flag) {
      setMode('raise');
      setComment('');
      setError(null);
    }
  }, [raiseRequest, entry.flag]);

  const superAdmin = scope === 'super-admin' && storeId !== null;

  function openModal(next: 'raise' | 'edit') {
    setMode(next);
    setComment(next === 'edit' ? flag?.comment ?? '' : '');
    setError(null);
  }

  function closeModal() {
    setMode(null);
    setComment('');
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = comment.trim();
    if (trimmed.length < 1) {
      setError('Please enter a comment.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const refreshed = superAdmin
        ? mode === 'raise'
          ? await flagSuperAdminCashEntry(storeId, entry.id, trimmed)
          : await editSuperAdminCashFlag(storeId, entry.id, trimmed)
        : mode === 'raise' ? await flagCashEntry(entry.id, trimmed) : await editCashFlag(entry.id, trimmed);
      onEntryChange(refreshed);
      closeModal();
      nfToast.success(mode === 'raise' ? 'Entry flagged and the employee notified.' : 'Flag comment updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the flag.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRemove() {
    setRemoving(true);
    try {
      onEntryChange(superAdmin ? await removeSuperAdminCashFlag(storeId, entry.id) : await removeCashFlag(entry.id));
      setRemoveOpen(false);
      nfToast.success('Flag removed.');
    } catch (cause) {
      nfToast.error(cause instanceof Error ? cause.message : 'Could not remove the flag.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="cash-flag" aria-label="Entry status">
      <div className="cash-flag__status-row">
        <span className={`cash-flag__pill cash-flag__pill--${entry.status.toLowerCase()}`}>{entry.status}</span>
      </div>

      {flag && (
        <div className="cash-flag__box" role="status">
          <p className="cash-flag__comment">“{flag.comment}”</p>
          <p className="cash-flag__meta">
            Flagged by {flag.flaggedByName ?? 'an admin'} · {formatWhen(flag.flaggedAt)}
            {flag.commentUpdatedAt && ` · comment edited ${formatWhen(flag.commentUpdatedAt)}`}
          </p>
        </div>
      )}

      {!flag && entry.resolvedFlag && (
        <div className="cash-flag__box cash-flag__box--resolved">
          <p className="cash-flag__meta">{resolvedLine(entry.resolvedFlag)}</p>
          {entry.resolvedFlag.resolutionNote && (
            <p className="cash-flag__comment">Note: {entry.resolvedFlag.resolutionNote}</p>
          )}
          <p className="cash-flag__meta">Original flag: “{entry.resolvedFlag.comment}”</p>
        </div>
      )}

      {canManage && (flag || !hideRaiseButton) && (
        <div className="cash-flag__actions">
          {flag ? (
            <>
              <button type="button" className="btn btn--secondary" onClick={() => openModal('edit')}>Edit flag comment</button>
              <button type="button" className="btn btn--secondary" onClick={() => setRemoveOpen(true)}>Remove flag</button>
            </>
          ) : hideRaiseButton ? null : (
            <button type="button" className="btn btn--secondary" onClick={() => openModal('raise')}>
              {entry.resolvedFlag?.resolution === 'EMPLOYEE_FIXED' ? 'Flag again' : 'Flag entry'}
            </button>
          )}
        </div>
      )}

      <Modal
        isOpen={mode !== null}
        onClose={closeModal}
        title={mode === 'edit' ? 'Edit flag comment' : 'Flag cash entry'}
        subtitle={mode === 'raise'
          ? 'The employee who entered this is notified with your comment.'
          : undefined}
        centered
      >
        <form onSubmit={submit} noValidate>
          <FormField label={superAdmin ? 'Note' : 'Flag comment'} htmlFor="cash-flag-comment" error={error ?? undefined} required>
            <textarea
              id="cash-flag-comment"
              className="input cash-flag__textarea"
              rows={3}
              maxLength={2000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Describe what looks off."
            />
          </FormField>
          <div className="cash-flag__modal-actions">
            <button type="button" className="btn btn--secondary" onClick={closeModal} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? <ButtonDots label="Saving" /> : mode === 'edit' ? 'Save' : 'Flag entry'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={removeOpen}
        title="Remove flag"
        message="Remove the flag from this cash entry? The flag history is kept."
        confirmLabel={removing ? 'Removing…' : 'Remove'}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveOpen(false)}
      />
    </section>
  );
}

export default CashEntryFlagSection;
