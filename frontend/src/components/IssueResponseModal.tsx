import { useEffect, useState } from 'react';
import type { Issue } from '../types/issue';
import { ISSUE_RESPONSE_MAX_LENGTH } from '../utils/issueStatusMeta';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import './IssueCard.css';

export type IssueResponseAction = 'ACKNOWLEDGED' | 'RESOLVED';

interface IssueResponseModalProps {
  // null = closed.
  issue: Issue | null;
  action: IssueResponseAction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (responseText: string) => void;
}

const COPY: Record<IssueResponseAction, { title: string; confirm: string; busy: string; placeholder: string }> = {
  ACKNOWLEDGED: {
    title: 'Acknowledge issue',
    confirm: 'Acknowledge',
    busy: 'Saving',
    placeholder: 'Optional note to the employee, e.g. "Part ordered, arriving Friday"…',
  },
  RESOLVED: {
    title: 'Resolve issue',
    confirm: 'Confirm Resolve',
    busy: 'Resolving',
    placeholder: 'Optional response to the employee…',
  },
};

// Shared Acknowledge/Resolve dialog for the Owner/Admin and Super Admin
// Issues pages. Built on the shared Modal so it gets Escape-to-close, focus
// return and the mobile viewport handling for free.
function IssueResponseModal({ issue, action, busy, onCancel, onConfirm }: IssueResponseModalProps) {
  const [text, setText] = useState('');
  const copy = COPY[action];

  // Fresh text each time the dialog opens for a (possibly different) issue.
  useEffect(() => {
    if (issue) setText('');
  }, [issue?.id, action]);

  const nearLimit = text.length >= ISSUE_RESPONSE_MAX_LENGTH * 0.9;

  return (
    <Modal
      isOpen={issue !== null}
      onClose={() => { if (!busy) onCancel(); }}
      centered
      title={copy.title}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn--primary${busy ? ' btn--loading' : ''}`}
            onClick={() => onConfirm(text.trim())}
            disabled={busy}
          >
            {busy ? <ButtonDots label={copy.busy} /> : copy.confirm}
          </button>
        </>
      }
    >
      {issue && <p className="issue-response-modal__note">{issue.note}</p>}
      <FormField label="Response" htmlFor="issue-response-text">
        <textarea
          id="issue-response-text"
          className="input"
          rows={3}
          value={text}
          maxLength={ISSUE_RESPONSE_MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.placeholder}
          autoFocus
        />
        <span className={`issue-text-counter${nearLimit ? ' issue-text-counter--near-limit' : ''}`} aria-live="polite">
          {text.length}/{ISSUE_RESPONSE_MAX_LENGTH}
        </span>
      </FormField>
    </Modal>
  );
}

export default IssueResponseModal;
