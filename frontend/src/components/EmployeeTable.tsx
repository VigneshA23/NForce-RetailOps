import { Pencil, Trash2, Unlock } from 'lucide-react';
import type { Employee } from '../types/employee';
import './EmployeeTable.css';

interface EmployeeTableProps {
  /** Already searched, filtered and paged by the page. */
  employees: Employee[];
  isLoading?: boolean;
  /** Resolved by the page, which alone can tell "none yet" from "none match". */
  emptyMessage?: string;
  onViewDetails: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
  onResetPassword: (employee: Employee) => void;
}

function EmployeeTable({
  employees,
  isLoading = false,
  emptyMessage = 'No employees match your filters.',
  onViewDetails,
  onEdit,
  onDelete,
  onToggleStatus,
  onResetPassword,
}: EmployeeTableProps) {
  return (
    <div className="table-card employee-table__card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Emp ID</th>
              <th scope="col">Employee Name</th>
              <th scope="col">Contact</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.empId}>
                <td data-label="Emp ID">
                  <button
                    type="button"
                    className="employee-table__emp-id employee-table__id-link"
                    onClick={() => onViewDetails(employee)}
                  >
                    {employee.empId}
                  </button>
                </td>
                <td className="employee-table__name" data-label="Employee Name">{employee.name}</td>
                <td data-label="Contact">{employee.phone}</td>
                <td data-label="Status">
                  <label
                    className="status-toggle"
                    title={employee.active ? 'Deactivate employee' : 'Activate employee'}
                  >
                    <input
                      type="checkbox"
                      checked={employee.active}
                      onChange={() => onToggleStatus(employee)}
                      aria-label={`${employee.active ? 'Deactivate' : 'Activate'} ${employee.name}`}
                    />
                    <span className="status-toggle__track" aria-hidden="true">
                      <span className="status-toggle__thumb" />
                    </span>
                  </label>
                </td>
                <td className="table-actions-cell" data-label="Actions">
                  <div className="table-row-actions">
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`Edit ${employee.name}`}
                      title="Edit"
                      onClick={() => onEdit(employee)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`Reset password for ${employee.name}`}
                      title="Reset Password"
                      onClick={() => onResetPassword(employee)}
                    >
                      <Unlock size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Delete ${employee.name}`}
                      title="Delete"
                      onClick={() => onDelete(employee)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && employees.length === 0 && (
        <div className="table-card__empty">{emptyMessage}</div>
      )}
      {isLoading && <div className="table-card__empty">Loading employees...</div>}
    </div>
  );
}

export default EmployeeTable;
