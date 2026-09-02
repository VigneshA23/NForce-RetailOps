import { Pencil, Trash2 } from 'lucide-react';
import type { Employee, EmployeeType } from '../types/employee';
import { getShiftTimeRange } from '../utils/employeeUtils';
import StoreChips from './StoreChips';
import './EmployeeTable.css';

interface EmployeeTableProps {
  /** Already searched, filtered and paged by the page. */
  employees: Employee[];
  isLoading?: boolean;
  /** Resolved by the page, which alone can tell "none yet" from "none match". */
  emptyMessage?: string;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
}

function TypeBadge({ type }: { type: EmployeeType }) {
  const className = type === 'Full Time' ? 'badge badge--solid' : 'badge badge--outline';
  return <span className={className}>{type}</span>;
}

function EmployeeTable({
  employees,
  isLoading = false,
  emptyMessage = 'No employees match your filters.',
  onEdit,
  onDelete,
  onToggleStatus,
}: EmployeeTableProps) {
  return (
    <div className="table-card employee-table__card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Emp ID</th>
              <th scope="col">Employee Name</th>
              <th scope="col">Assigned Stores</th>
              <th scope="col">Shift</th>
              <th scope="col">Contact</th>
              <th scope="col">Type</th>
              <th scope="col">Email</th>
              <th scope="col">Gender</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.empId}>
                <td className="employee-table__emp-id" data-label="Emp ID">{employee.empId}</td>
                <td className="employee-table__name" data-label="Employee Name">{employee.name}</td>
                <td data-label="Assigned Stores">
                  <StoreChips stores={employee.stores} emptyLabel="No stores" />
                </td>
                <td data-label="Shift">
                  <div className="employee-table__shift">
                    <div className="employee-table__shift-name">{employee.shift}</div>
                    <div className="employee-table__shift-range">
                      ({getShiftTimeRange(employee.shift)})
                    </div>
                  </div>
                </td>
                <td data-label="Contact">
                  <a className="employee-table__link" href={`tel:${employee.phone}`}>
                    {employee.phone}
                  </a>
                </td>
                <td data-label="Type">
                  <TypeBadge type={employee.employeeType} />
                </td>
                <td data-label="Email">
                  <a className="employee-table__link" href={`mailto:${employee.email}`}>
                    {employee.email}
                  </a>
                </td>
                <td data-label="Gender">{employee.gender}</td>
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
