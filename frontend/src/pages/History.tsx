import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Sheet } from 'lucide-react';
import { ChecklistHistoryRangeError, getChecklistHistoryOperationsReport } from '../api/checklistHistory';
import type { ChecklistHistoryOperationsReport, ChecklistTaskDetailStatus } from '../types/checklistHistory';
import { formatDateLabel, todayDate } from '../utils/checklistHistoryOptions';
import { buildOperationsReportCsv, completionPercent, summarizeByStore, TASK_DETAIL_STATUS_LABELS } from '../utils/operationsReportExport';
import { downloadCsv } from '../utils/csv';
import './History.css';

const ALL = 'ALL';
type FilterValue = typeof ALL | string;

function History() {
  // Daily Operations Summary report -- takes no store selection at all: the
  // backend always resolves the stores this Owner/Admin is authorized for, so
  // there is nothing to pick here.
  const [reportStartDate, setReportStartDate] = useState(todayDate);
  const [reportEndDate, setReportEndDate] = useState(todayDate);
  const [report, setReport] = useState<ChecklistHistoryOperationsReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportRangeValidationError, setReportRangeValidationError] = useState<string | null>(null);

  // Task Details filters -- applied client-side on top of the already date-range-
  // and store-authorization-scoped rows the backend returned, the same way the
  // Tasks page filters an already-fetched list rather than re-querying per filter.
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<FilterValue>(ALL);
  const [taskNameFilter, setTaskNameFilter] = useState<FilterValue>(ALL);
  const [taskStatusFilter, setTaskStatusFilter] = useState<ChecklistTaskDetailStatus | typeof ALL>(ALL);
  const [taskResponseFilter, setTaskResponseFilter] = useState<FilterValue>(ALL);
  const [taskUserFilter, setTaskUserFilter] = useState<FilterValue>(ALL);

  // Guards against a slow, superseded request overwriting the screen with stale
  // data once a newer request (a different date range) has already resolved --
  // e.g. searching 01-09..04-09 then immediately narrowing to 03-09..04-09 must
  // never let the first (slower) response repopulate Task Details afterward.
  const reportRequestIdRef = useRef(0);

  function generateReport() {
    if (reportStartDate > reportEndDate) {
      setReportRangeValidationError('Start date must be on or before end date.');
      return;
    }
    setReportRangeValidationError(null);
    setReportLoading(true);
    setReportError(null);
    const requestId = ++reportRequestIdRef.current;
    getChecklistHistoryOperationsReport({ startDate: reportStartDate, endDate: reportEndDate })
      .then((result) => {
        if (requestId !== reportRequestIdRef.current) return;
        setReport(result);
      })
      .catch((error: Error) => {
        if (requestId !== reportRequestIdRef.current) return;
        setReport(null);
        setReportError(
          error instanceof ChecklistHistoryRangeError ? error.message : 'Failed to load the operations summary.',
        );
      })
      .finally(() => {
        if (requestId === reportRequestIdRef.current) setReportLoading(false);
      });
  }

  // Fires once on mount with today's date -- every subsequent refresh is
  // explicit via the Generate Report button.
  useEffect(() => {
    generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaryTotals = useMemo(() => summarizeByStore(report?.summary ?? []), [report]);
  const reportRangeLabel =
    reportStartDate === reportEndDate ? formatDateLabel(reportStartDate) : `${formatDateLabel(reportStartDate)} - ${formatDateLabel(reportEndDate)}`;

  const details = report?.details ?? [];

  // Filter option lists come from the actual fetched Task Details rows for the
  // selected date range -- never a hard-coded list -- so a Category/Task/
  // Response/User only appears here if it actually occurred in that range.
  const categoryOptions = useMemo(
    () => Array.from(new Set(details.map((row) => row.categoryName))).sort((a, b) => a.localeCompare(b)),
    [details],
  );
  const taskOptions = useMemo(() => {
    const scoped = taskCategoryFilter === ALL ? details : details.filter((row) => row.categoryName === taskCategoryFilter);
    return Array.from(new Set(scoped.map((row) => row.taskName))).sort((a, b) => a.localeCompare(b));
  }, [details, taskCategoryFilter]);
  const responseOptions = useMemo(
    () => Array.from(new Set(details.map((row) => row.response).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
    [details],
  );
  const userOptions = useMemo(
    () => Array.from(new Set(details.map((row) => row.employeeFullName).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
    [details],
  );

  // Dependent filtering (Tasks page pattern): narrowing Category can make the
  // currently selected Task no longer applicable -- fall back to "All Tasks"
  // instead of silently filtering everything out.
  useEffect(() => {
    if (taskNameFilter !== ALL && !taskOptions.includes(taskNameFilter)) {
      setTaskNameFilter(ALL);
    }
  }, [taskOptions, taskNameFilter]);

  const filteredDetails = useMemo(
    () =>
      details.filter((row) => {
        if (taskCategoryFilter !== ALL && row.categoryName !== taskCategoryFilter) return false;
        if (taskNameFilter !== ALL && row.taskName !== taskNameFilter) return false;
        if (taskStatusFilter !== ALL && row.status !== taskStatusFilter) return false;
        if (taskResponseFilter !== ALL && row.response !== taskResponseFilter) return false;
        if (taskUserFilter !== ALL && row.employeeFullName !== taskUserFilter) return false;
        return true;
      }),
    [details, taskCategoryFilter, taskNameFilter, taskStatusFilter, taskResponseFilter, taskUserFilter],
  );

  function handleExportCsv() {
    if (!report) return;
    const csv = buildOperationsReportCsv(summaryTotals, filteredDetails, reportStartDate, reportEndDate);
    downloadCsv(`daily-operations-summary_${reportStartDate}_to_${reportEndDate}.csv`, csv);
  }

  function handlePrintReport() {
    window.print();
  }

  return (
    <div className="history-page">
      <div className="history-page__report">
        <div className="history-page__report-header history-page__no-print">
          <div>
            <h2 className="history-page__report-heading">Daily Operations Summary</h2>
            <p className="history-page__subheading">
              Scheduled, completed and Issue counts per store over a date range.
            </p>
          </div>
        </div>

        <div className="history-page__print-only history-page__report-print-header">
          <h2>Daily Operations Summary</h2>
          <p>Date Range: {reportRangeLabel}</p>
        </div>

        <div className="filter-bar history-page__no-print">
          <label className="history-page__date-field">
            From Date
            <input
              type="date"
              value={reportStartDate}
              max={reportEndDate}
              onChange={(event) => setReportStartDate(event.target.value || todayDate())}
            />
          </label>

          <label className="history-page__date-field">
            To Date
            <input
              type="date"
              value={reportEndDate}
              min={reportStartDate}
              max={todayDate()}
              onChange={(event) => setReportEndDate(event.target.value || todayDate())}
            />
          </label>

          {report && report.details.length > 0 && (
            <>
              <div className="history-page__date-field">
                <span className="history-page__filter-spacer" aria-hidden="true">&nbsp;</span>
                <select
                  className="select filter"
                  aria-label="Category"
                  value={taskCategoryFilter}
                  onChange={(event) => setTaskCategoryFilter(event.target.value)}
                >
                  <option value={ALL}>All Categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-page__date-field">
                <span className="history-page__filter-spacer" aria-hidden="true">&nbsp;</span>
                <select
                  className="select filter"
                  aria-label="Task"
                  value={taskNameFilter}
                  onChange={(event) => setTaskNameFilter(event.target.value)}
                >
                  <option value={ALL}>All Tasks</option>
                  {taskOptions.map((task) => (
                    <option key={task} value={task}>
                      {task}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-page__date-field">
                <span className="history-page__filter-spacer" aria-hidden="true">&nbsp;</span>
                <select
                  className="select filter filter--narrow"
                  aria-label="Status"
                  value={taskStatusFilter}
                  onChange={(event) => setTaskStatusFilter(event.target.value as ChecklistTaskDetailStatus | typeof ALL)}
                >
                  <option value={ALL}>All Statuses</option>
                  <option value="COMPLETED">{TASK_DETAIL_STATUS_LABELS.COMPLETED}</option>
                  <option value="NOT_COMPLETED">{TASK_DETAIL_STATUS_LABELS.NOT_COMPLETED}</option>
                  <option value="ISSUE">{TASK_DETAIL_STATUS_LABELS.ISSUE}</option>
                </select>
              </div>

              <div className="history-page__date-field">
                <span className="history-page__filter-spacer" aria-hidden="true">&nbsp;</span>
                <select
                  className="select filter"
                  aria-label="Response"
                  value={taskResponseFilter}
                  onChange={(event) => setTaskResponseFilter(event.target.value)}
                >
                  <option value={ALL}>All Responses</option>
                  {responseOptions.map((response) => (
                    <option key={response} value={response}>
                      {response}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-page__date-field">
                <span className="history-page__filter-spacer" aria-hidden="true">&nbsp;</span>
                <select
                  className="select filter"
                  aria-label="User"
                  value={taskUserFilter}
                  onChange={(event) => setTaskUserFilter(event.target.value)}
                >
                  <option value={ALL}>All Users</option>
                  {userOptions.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {reportRangeValidationError && (
          <p className="history-page__validation history-page__no-print">{reportRangeValidationError}</p>
        )}

        {reportError ? (
          <div className="history-page__error history-page__no-print">
            {reportError}
            <button type="button" className="btn btn--secondary" onClick={generateReport}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="table-card">
              <div className="table-scroll">
                <table className="data-table" data-testid="operations-summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Store</th>
                      <th scope="col">Scheduled</th>
                      <th scope="col">Completed</th>
                      <th scope="col">Completion %</th>
                      <th scope="col">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryTotals.map((row) => (
                      <tr key={row.storeId}>
                        <td data-label="Store">{row.storeName}</td>
                        <td data-label="Scheduled">{row.scheduled}</td>
                        <td data-label="Completed">{row.completed}</td>
                        <td data-label="Completion %">{completionPercent(row.scheduled, row.completed)}%</td>
                        <td data-label="Issues">{row.issues}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!reportLoading && summaryTotals.length === 0 && (
                <div className="table-card__empty">No operations data found for the selected date range.</div>
              )}
              {reportLoading && <div className="table-card__empty">Loading operations summary...</div>}
            </div>

            {report && report.details.length > 0 && (
              <div className="history-page__task-details">
                <h3 className="history-page__report-heading">Task Details</h3>

                <div className="table-card">
                  <div className="table-scroll">
                    <table className="data-table" data-testid="operations-task-details-table">
                      <thead>
                        <tr>
                          <th scope="col">Store</th>
                          <th scope="col">Date</th>
                          <th scope="col">Category</th>
                          <th scope="col">Task</th>
                          <th scope="col">Status</th>
                          <th scope="col">Response</th>
                          <th scope="col">User</th>
                          <th scope="col">Completion Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDetails.map((row, index) => (
                          <tr key={`${row.storeId}-${row.date}-${row.taskName}-${index}`}>
                            <td data-label="Store">{row.storeName}</td>
                            <td data-label="Date">{formatDateLabel(row.date)}</td>
                            <td data-label="Category">{row.categoryName}</td>
                            <td data-label="Task">{row.taskName}</td>
                            <td data-label="Status">
                              <span
                                className={`badge ${
                                  row.status === 'COMPLETED'
                                    ? 'badge--success'
                                    : row.status === 'ISSUE'
                                      ? 'badge--danger'
                                      : 'badge--outline'
                                }`}
                              >
                                {TASK_DETAIL_STATUS_LABELS[row.status]}
                              </span>
                            </td>
                            <td data-label="Response">{row.response ?? '—'}</td>
                            <td data-label="User">{row.employeeFullName ?? '—'}</td>
                            <td data-label="Completion Time">
                              {row.completedAt ? new Date(row.completedAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredDetails.length === 0 && (
                    <div className="table-card__empty">No task details match the selected filters.</div>
                  )}
                </div>
              </div>
            )}

            <div className="history-page__report-footer-actions history-page__no-print">
              <button type="button" className="btn btn--primary" disabled={reportLoading} onClick={generateReport}>
                Generate Report
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleExportCsv} disabled={!report}>
                <Sheet size={16} />
                Export CSV
              </button>
              <button type="button" className="btn btn--secondary" onClick={handlePrintReport} disabled={!report}>
                <Printer size={16} />
                Print
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default History;
