import type { ReactNode } from 'react';
import { Clock, MessageSquare } from 'lucide-react';
import type { Issue } from '../types/issue';
import { ISSUE_STATUS_META, formatIssueDate, formatIssueTime } from '../utils/issueStatusMeta';
import './IssueCard.css';

interface IssueCardProps {
  issue: Issue;
  // DOM id prefix -- the card's id is `${idPrefix}-${issue.id}`, which the
  // pages' focus effect uses to scroll a deep-linked issue into view.
  idPrefix: string;
  showStore?: boolean;
  showEmployee?: boolean;
  highlighted?: boolean;
  // Employee view: always render the response block, with a placeholder
  // while nobody has responded yet. Admin views omit the block entirely.
  showResponsePlaceholder?: boolean;
  actions?: ReactNode;
}

function responderLabel(issue: Issue): string | null {
  if (!issue.respondedByFullName) return null;
  return issue.respondedBySuperAdmin ? `${issue.respondedByFullName} (Super Admin)` : issue.respondedByFullName;
}

function IssueCard({
  issue,
  idPrefix,
  showStore = false,
  showEmployee = false,
  highlighted = false,
  showResponsePlaceholder = false,
  actions,
}: IssueCardProps) {
  const meta = ISSUE_STATUS_META[issue.status];
  const responder = responderLabel(issue);

  return (
    <div
      className={`issue-card issue-card--${issue.status.toLowerCase()}${highlighted ? ' issue-card--highlighted' : ''}`}
      id={`${idPrefix}-${issue.id}`}
    >
      <div className="issue-card__header">
        <span className="issue-card__raised">
          <Clock size={14} strokeWidth={2} aria-hidden="true" />
          <span>{formatIssueDate(issue.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatIssueTime(issue.createdAt)}</span>
        </span>
        <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
      </div>

      {(showStore || showEmployee) && (
        <div className="issue-card__meta">
          {showStore && (
            <span className="issue-card__meta-item">
              <span className="issue-card__label">Store</span>
              <span className="issue-card__meta-value issue-card__meta-value--strong">{issue.storeName}</span>
            </span>
          )}
          {showEmployee && (
            <span className="issue-card__meta-item">
              <span className="issue-card__label">Employee</span>
              <span className="issue-card__meta-value">{issue.employeeFullName}</span>
            </span>
          )}
        </div>
      )}

      <div className="issue-card__issue">
        <span className="issue-card__section-icon" role="img" aria-label="Issue">
          <MessageSquare size={11} strokeWidth={2.25} aria-hidden="true" />
        </span>
        <p className="issue-card__note">{issue.note}</p>
      </div>

      {(issue.responseText || showResponsePlaceholder) && (
        <div className="issue-card__section issue-card__response-block">
          <span className="issue-card__label">
            {issue.responseText && responder ? `Response from ${responder}` : 'Response'}
            {issue.responseText && issue.respondedAt && (
              <span className="issue-card__response-time">
                {' · '}{formatIssueDate(issue.respondedAt)}, {formatIssueTime(issue.respondedAt)}
              </span>
            )}
          </span>
          {issue.responseText ? (
            <div className="issue-card__response-box">
              <span className="issue-card__response">{issue.responseText}</span>
            </div>
          ) : (
            <span className="issue-card__response issue-card__response--hint">
              {issue.status === 'ACKNOWLEDGED'
                ? `Being looked into${responder ? ` by ${responder}` : ''}`
                : issue.status === 'RESOLVED'
                  ? `Resolved${responder ? ` by ${responder}` : ''}`
                  : 'Awaiting response'}
            </span>
          )}
        </div>
      )}

      {actions && <div className="issue-card__actions-row">{actions}</div>}
    </div>
  );
}

export default IssueCard;
