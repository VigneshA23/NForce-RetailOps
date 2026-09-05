import { Pencil, Trash2 } from 'lucide-react';
import type { SuperAdminEmployee } from '../types/superAdminEmployee';
import './EmployeeTable.css';

interface SuperAdminEmployeeTableProps {
  employees: SuperAdminEmployee[];
  isLoading?: boolean;
  emptyMessage?: string;
  onViewDetails: (employee: SuperAdminEmployee) => void;
  onEdit: (employee: SuperAdminEmployee) => void;
  onToggleStatus: (employee: SuperAdminEmployee) => void;
  onDelete: (employee: SuperAdminEmployee) => void;
}

function SuperAdminEmployeeTable({
  employees,
  isLoading = false,
  emptyMessage = 'No employees match your filters.',
  onViewDetails,
  onEdit,
  onToggleStatus,
  onDelete,
}: SuperAdminEmployeeTableProps) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Emp ID</th>
              <th scope="col">Employee Name</th>
              <th scope="col">Owner</th>
              <th scope="col">Contact</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
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
                <td data-label="Owner">{employee.ownerName}</td>
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
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Permanently delete ${employee.name}`}
                      title="Permanently delete"
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
      {!isLoading && employees.length === 0 && <div className="table-card__empty">{emptyMessage}</div>}
      {isLoading && <div className="table-card__empty">Loading employees...</div>}
    </div>
  );
}

export default SuperAdminEmployeeTable;
