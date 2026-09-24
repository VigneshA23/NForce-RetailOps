import type { ReactNode } from 'react';
import { MessageSquare, User } from 'lucide-react';
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
      className={`issue-card${highlighted ? ' issue-card--highlighted' : ''}`}
      id={`${idPrefix}-${issue.id}`}
    >
      <div className="issue-card__icon" aria-hidden="true">
        <MessageSquare size={16} strokeWidth={2} />
      </div>
      <div className="issue-card__body">
        <div className="issue-card__top">
          {showStore && (
            <div className="issue-card__field">
              <span className="issue-card__label">Store</span>
              <span className="issue-card__value issue-card__value--strong">{issue.storeName}</span>
            </div>
          )}
          {showEmployee && (
            <div className="issue-card__field">
              <span className="issue-card__label">Employee</span>
              <span className="issue-card__value">{issue.employeeFullName}</span>
            </div>
          )}
          <div className="issue-card__field issue-card__field--grow">
            <span className="issue-card__label">Issue</span>
            <span className="issue-card__value issue-card__note">{issue.note}</span>
          </div>
          <div className="issue-card__field">
            <span className="issue-card__label">Raised</span>
            <span className="issue-card__value issue-card__date-cell">
              <span>{formatIssueDate(issue.createdAt)}</span>
              <span className="issue-card__time">{formatIssueTime(issue.createdAt)}</span>
            </span>
          </div>
          <div className="issue-card__field issue-card__field--status">
            <span className="issue-card__label">Status</span>
            <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
          </div>
        </div>

        {(issue.responseText || showResponsePlaceholder) && (
          <>
            <hr className="issue-card__divider" />
            <div className="issue-card__response-block">
              <span className="issue-card__response-label">
                {issue.responseText && responder ? `Response from ${responder}` : 'Response'}
                {issue.responseText && issue.respondedAt && (
                  <span className="issue-card__response-time">
                    {' · '}{formatIssueDate(issue.respondedAt)}, {formatIssueTime(issue.respondedAt)}
                  </span>
                )}
              </span>
              {issue.responseText ? (
                <div className="issue-card__response-box">
                  <span className="issue-card__response-avatar" aria-hidden="true">
                    <User size={14} strokeWidth={2} />
                  </span>
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
          </>
        )}

        {actions && <div className="issue-card__actions-row">{actions}</div>}
      </div>
    </div>
  );
}

export default IssueCard;
