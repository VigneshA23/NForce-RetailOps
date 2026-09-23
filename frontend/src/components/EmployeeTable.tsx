import { Eye, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { Employee } from '../types/employee';
import UserAvatar from './UserAvatar';
import { getInitials } from '../utils/initials';
import './EmployeeTable.css';
import './EmployeeCards.css';

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
}

function EmployeeTable({
  employees,
  isLoading = false,
  emptyMessage = 'No employees match your filters.',
  onViewDetails,
  onEdit,
  onDelete,
  onToggleStatus,
}: EmployeeTableProps) {
  return (
    <div className="table-card employee-table__card employee-cards">
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
                <td className="employee-cards__id" data-label="Emp ID">
                  <button
                    type="button"
                    className="employee-table__emp-id employee-table__id-link"
                    onClick={() => onViewDetails(employee)}
                  >
                    {employee.empId}
                  </button>
                </td>
                <td className="employee-table__name" data-label="Employee Name">
                  <div className="employee-table__name-cell">
                    <span className="employee-cards__avatar">
                      <UserAvatar initials={getInitials(employee.name)} src={employee.avatarUrl} size={28} />
                      {/* Mobile-only presence dot: green active, grey inactive. */}
                      <span
                        className={`employee-cards__status-dot${employee.active ? ' employee-cards__status-dot--active' : ''}`}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="employee-cards__name-text">{employee.name}</span>
                    {/* Mobile-only: this table has no Stores column on wider screens. */}
                    <span className="employee-cards__stores-heading">
                      <MapPin size={12} aria-hidden="true" />
                      {employee.stores.length === 1
                        ? 'Assigned Store'
                        : `Assigned Stores (${employee.stores.length})`}
                    </span>
                    {employee.stores.length === 0 ? (
                      <span className="employee-table__no-stores employee-cards__mobile-only">—</span>
                    ) : (
                      <span className="employee-table__store-badges employee-cards__mobile-only">
                        {employee.stores.map((store) => (
                          <span key={store.id} className="employee-table__store-badge">{store.name}</span>
                        ))}
                      </span>
                    )}
                  </div>
                </td>
                <td className="employee-cards__contact" data-label="Contact">{employee.phone}</td>
                <td className="employee-cards__status" data-label="Status">
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
                      aria-label={`View ${employee.name}`}
                      title="View details"
                      onClick={() => onViewDetails(employee)}
                    >
                      <Eye size={16} />
                    </button>
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
