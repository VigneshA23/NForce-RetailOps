import { useEffect, useMemo, useState } from 'react';
import { MessageSquareWarning, Printer, Send } from 'lucide-react';
import { ChecklistHistoryRangeError, getChecklistHistoryDetail, getChecklistHistorySummary } from '../api/checklistHistory';
import { getStoreIssues, respondToIssue, type Issue } from '../api/issues';
import type { ChecklistHistoryDetail, ChecklistHistorySummaryRow } from '../types/checklistHistory';
import StoreDetailTable, { type StoreDetailRow } from '../components/StoreDetailTable';
import { formatDateLabel, formatTimeLabel, taskStatus, todayDate } from '../utils/checklistHistoryOptions';
import './StoreDetail.css';

type FilterKey = 'ALL' | 'COMPLETE' | 'OPEN' | 'ISSUE';

interface StoreDetailProps {
  storeId: number | null;
}

function StoreDetail({ storeId }: StoreDetailProps) {
  const [date, setDate] = useState(todayDate);

  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('ALL');

  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<number, string>>({});
  const [respondingIssueId, setRespondingIssueId] = useState<number | null>(null);

  const [reportStartDate, setReportStartDate] = useState(todayDate);
  const [reportEndDate, setReportEndDate] = useState(todayDate);
  const [reportRows, setReportRows] = useState<ChecklistHistorySummaryRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  function loadDetail(id: number, forDate: string) {
    setDetailLoading(true);
    setDetailError(null);
    getChecklistHistoryDetail(id, forDate)
      .then(setDetail)
      .catch((error: Error) => setDetailError(error.message))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => {
    if (storeId === null) return;
    setFilter('ALL');
    loadDetail(storeId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, date]);

  function loadIssues(id: number) {
    setIssuesLoading(true);
    setIssuesError(null);
    getStoreIssues(id)
      .then(setIssues)
      .catch((error: Error) => setIssuesError(error.message))
      .finally(() => setIssuesLoading(false));
  }

  useEffect(() => {
    if (storeId === null) return;
    loadIssues(storeId);
  }, [storeId]);

  async function handleRespondToIssue(issueId: number) {
    if (storeId === null) return;
    const responseText = (responseDrafts[issueId] ?? '').trim();
    if (!responseText) return;
    setRespondingIssueId(issueId);
    try {
      const updated = await respondToIssue(storeId, issueId, responseText);
      setIssues((current) => current.map((issue) => (issue.id === updated.id ? updated : issue)));
      setResponseDrafts((current) => {
        const next = { ...current };
        delete next[issueId];
        return next;
      });
    } catch (error) {
      setIssuesError(error instanceof Error ? error.message : 'Failed to send the response');
    } finally {
      setRespondingIssueId(null);
    }
  }

  const openIssues = useMemo(() => issues.filter((issue) => issue.status === 'OPEN'), [issues]);
  const resolvedIssues = useMemo(() => issues.filter((issue) => issue.status === 'RESOLVED'), [issues]);

  const rows = useMemo<StoreDetailRow[]>(() => {
    if (!detail) return [];
    return detail.categories.flatMap((category) =>
      category.tasks.map((task) => ({ key: `${category.id}-${task.id}`, categoryName: category.name, task })),
    );
  }, [detail]);

  const counts = useMemo(() => {
    let completed = 0;
    let open = 0;
    let issues = 0;
    for (const row of rows) {
      const status = taskStatus(row.task);
      if (status === 'COMPLETE') completed += 1;
      else if (status === 'OPEN') open += 1;
      else issues += 1;
    }
    return { total: rows.length, completed, open, issues };
  }, [rows]);

  const completionPercent = counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 100);

  const categoryProgress = useMemo(() => {
    if (!detail) return [];
    return detail.categories.map((category) => {
      const completed = category.tasks.filter((task) => taskStatus(task) === 'COMPLETE').length;
      return { id: category.id, name: category.name, completed, total: category.tasks.length };
    });
  }, [detail]);

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((row) => taskStatus(row.task) === filter);
  }, [rows, filter]);

  function toggleFilter(next: FilterKey) {
    setFilter((current) => (current === next ? 'ALL' : next));
  }

  if (storeId === null) {
    return (
      <div className="store-detail-page">
        <p className="store-detail-page__empty">No store assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="store-detail-page">
      <div className="store-detail-page__header">
        <h1 className="store-detail-page__heading">Daily checklist</h1>
        <p className="store-detail-page__subheading">Every task for your store, with who recorded it.</p>
      </div>

      <div className="filter-bar store-detail-page__filters">
        <label className="store-detail-page__date-field">
          Date
          <input
            type="date"
            value={date}
            max={todayDate()}
            onChange={(event) => setDate(event.target.value || todayDate())}
          />
        </label>
      </div>

      <div className="stat-card-row store-detail-page__stat-row">
        <button
          type="button"
          className={`store-detail-chip${filter === 'ALL' ? ' store-detail-chip--active' : ''}`}
          onClick={() => toggleFilter('ALL')}
        >
          <span className="store-detail-chip__value">{counts.total}</span>
          <span className="store-detail-chip__label">Total Tasks</span>
        </button>
        <button
          type="button"
          className={`store-detail-chip${filter === 'COMPLETE' ? ' store-detail-chip--active' : ''}`}
          onClick={() => toggleFilter('COMPLETE')}
        >
          <span className="store-detail-chip__value">{counts.completed}</span>
          <span className="store-detail-chip__label">Completed</span>
        </button>
        <button
          type="button"
          className={`store-detail-chip${filter === 'OPEN' ? ' store-detail-chip--active' : ''}`}
          onClick={() => toggleFilter('OPEN')}
        >
          <span className="store-detail-chip__value">{counts.open}</span>
          <span className="store-detail-chip__label">No Response</span>
        </button>
        <button
          type="button"
          className={`store-detail-chip store-detail-chip--danger${
            filter === 'ISSUE' ? ' store-detail-chip--active' : ''
          }`}
          onClick={() => toggleFilter('ISSUE')}
        >
          <span className="store-detail-chip__value">{counts.issues}</span>
          <span className="store-detail-chip__label">Issues</span>
        </button>
        <div className="store-detail-chip store-detail-chip--static">
          <span className="store-detail-chip__value">{completionPercent}%</span>
          <span className="store-detail-chip__label">Completion</span>
        </div>
      </div>

      {categoryProgress.length > 0 && (
        <div className="store-detail-page__category-progress">
          {categoryProgress.map((category) => (
            <span
              key={category.id}
              className={`badge ${category.total > 0 && category.completed === category.total ? 'badge--success' : 'badge--outline'}`}
            >
              {category.name} {category.completed}/{category.total}
            </span>
          ))}
        </div>
      )}

      <p className="store-detail-page__hint">Click a box to filter · click again to clear</p>

      {detailError ? (
        <div className="store-detail-page__error">
          {detailError}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => loadDetail(storeId, date)}
          >
            Retry
          </button>
        </div>
      ) : (
        <StoreDetailTable rows={filteredRows} isLoading={detailLoading} hasChecklist={detail?.hasChecklist ?? false} />
      )}

      <div className="store-detail-page__issues">
        <div className="store-detail-page__issues-header">
          <h2 className="store-detail-page__report-heading">Raised Issues</h2>
          <p className="store-detail-page__subheading">Issues employees have raised for this store.</p>
        </div>

        {issuesError && (
          <div className="store-detail-page__error">
            {issuesError}
            <button type="button" className="btn btn--secondary" onClick={() => storeId !== null && loadIssues(storeId)}>
              Retry
            </button>
          </div>
        )}

        {!issuesError && issuesLoading && <p className="store-detail-page__hint">Loading issues...</p>}

        {!issuesError && !issuesLoading && issues.length === 0 && (
          <p className="store-detail-page__hint">No issues have been raised for this store yet.</p>
        )}

        {!issuesError && openIssues.length > 0 && (
          <div className="store-detail-issue-list">
            {openIssues.map((issue) => (
              <div key={issue.id} className="store-detail-issue-card">
                <div className="store-detail-issue-card__top">
                  <span className="store-detail-issue-card__icon" aria-hidden="true">
                    <MessageSquareWarning size={16} />
                  </span>
                  <div className="store-detail-issue-card__info">
                    <p className="store-detail-issue-card__note">{issue.note}</p>
                    <p className="store-detail-page__hint">
                      {issue.employeeName} · {formatTimeLabel(issue.createdAt)}
                    </p>
                  </div>
                  <span className="badge badge--warning">Open</span>
                </div>
                <div className="store-detail-issue-card__respond">
                  <textarea
                    className="input store-detail-issue-card__textarea"
                    placeholder="Write a response..."
                    value={responseDrafts[issue.id] ?? ''}
                    onChange={(event) =>
                      setResponseDrafts((current) => ({ ...current, [issue.id]: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn--primary store-detail-issue-card__send"
                    disabled={!(responseDrafts[issue.id] ?? '').trim() || respondingIssueId === issue.id}
                    onClick={() => handleRespondToIssue(issue.id)}
                  >
                    <Send size={14} />
                    {respondingIssueId === issue.id ? 'Sending...' : 'Send Response'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!issuesError && resolvedIssues.length > 0 && (
          <div className="store-detail-issue-list store-detail-issue-list--resolved">
            {resolvedIssues.map((issue) => (
              <div key={issue.id} className="store-detail-issue-card store-detail-issue-card--resolved">
                <div className="store-detail-issue-card__top">
                  <span className="store-detail-issue-card__icon" aria-hidden="true">
                    <MessageSquareWarning size={16} />
                  </span>
                  <div className="store-detail-issue-card__info">
                    <p className="store-detail-issue-card__note">{issue.note}</p>
                    <p className="store-detail-page__hint">
                      {issue.employeeName} · {formatTimeLabel(issue.createdAt)}
                    </p>
                  </div>
                  <span className="badge badge--success">Resolved</span>
                </div>
                <p className="store-detail-issue-card__response-text">{issue.responseText}</p>
                <p className="store-detail-page__hint">
                  {issue.respondedByName}
                  {issue.respondedAt ? ` · ${formatTimeLabel(issue.respondedAt)}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="store-detail-page__report">
        <div className="store-detail-page__report-header store-detail-page__no-print">
          <div>
            <h2 className="store-detail-page__report-heading">Daily Operations Summary</h2>
            <p className="store-detail-page__subheading">
              Scheduled, completed and exception counts over a date range.
            </p>
          </div>
          <button type="button" className="btn btn--secondary" onClick={handlePrintReport}>
            <Printer size={16} />
            Print
          </button>
        </div>

        <div className="store-detail-page__print-only store-detail-page__report-print-header">
          <h2>Daily Operations Summary</h2>
          <p>{reportRangeLabel}</p>
        </div>

        <div className="filter-bar store-detail-page__filters store-detail-page__no-print">
          <label className="store-detail-page__date-field">
            Start Date *
            <input
              type="date"
              value={reportStartDate}
              max={reportEndDate}
              onChange={(event) => setReportStartDate(event.target.value || todayDate())}
            />
          </label>

          <label className="store-detail-page__date-field">
            End Date *
            <input
              type="date"
              value={reportEndDate}
              min={reportStartDate}
              max={todayDate()}
              onChange={(event) => setReportEndDate(event.target.value || todayDate())}
            />
          </label>
        </div>

        {reportError ? (
          <div className="store-detail-page__error store-detail-page__no-print">
            {reportError}
            <button type="button" className="btn btn--secondary" onClick={loadReport}>
              Retry
            </button>
          </div>
        ) : (
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Store</th>
                    <th scope="col">Scheduled</th>
                    <th scope="col">Completed</th>
                    <th scope="col">Completion %</th>
                    <th scope="col">Exceptions</th>
                  </tr>
                </thead>
                <tbody>
                  {operationsSummary.map((row) => {
                    const percent = row.scheduled === 0 ? 0 : Math.round((row.completed / row.scheduled) * 100);
                    return (
                      <tr key={row.storeId}>
                        <td data-label="Store">{row.storeName}</td>
                        <td data-label="Scheduled">{row.scheduled}</td>
                        <td data-label="Completed">{row.completed}</td>
                        <td data-label="Completion %">{percent}%</td>
                        <td data-label="Exceptions">{row.exceptions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!reportLoading && operationsSummary.length === 0 && (
              <div className="table-card__empty">No scheduled tasks in this date range.</div>
            )}
            {reportLoading && <div className="table-card__empty">Loading operations summary...</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default StoreDetail;
