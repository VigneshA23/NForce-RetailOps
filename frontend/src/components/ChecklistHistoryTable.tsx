import { Eye } from 'lucide-react';
import type { ChecklistHistorySummaryRow } from '../types/checklistHistory';
import { formatDateLabel } from '../utils/checklistHistoryOptions';
import './ChecklistHistoryTable.css';

interface ChecklistHistoryTableProps {
  rows: ChecklistHistorySummaryRow[];
  isLoading?: boolean;
  onView: (row: ChecklistHistorySummaryRow) => void;
}

function ChecklistHistoryTable({ rows, isLoading = false, onView }: ChecklistHistoryTableProps) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Store</th>
              <th scope="col">Date</th>
              <th scope="col">Completion</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.storeId}-${row.date}`}>
                <td data-label="Store">{row.storeName}</td>
                <td data-label="Date">{formatDateLabel(row.date)}</td>
                <td data-label="Completion">
                  {row.hasChecklist ? (
                    <span>
                      {row.completedTasks}/{row.totalTasks} completed
                    </span>
                  ) : (
                    <span className="checklist-history-table__empty-cell">
                      No checklist records found for this date
                    </span>
                  )}
                </td>
                <td className="checklist-history-table__actions-cell" data-label="Actions">
                  {row.hasChecklist ? (
                    <button
                      type="button"
                      className="checklist-history-table__view-btn"
                      aria-label={`View ${row.storeName} checklist for ${formatDateLabel(row.date)}`}
                      onClick={() => onView(row)}
                    >
                      <Eye size={16} />
                      View
                    </button>
                  ) : (
                    <span aria-hidden="true">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && rows.length === 0 && (
        <div className="table-card__empty">No results for the selected stores and date range.</div>
      )}
      {isLoading && <div className="table-card__empty">Loading checklist history...</div>}
    </div>
  );
}

export default ChecklistHistoryTable;
