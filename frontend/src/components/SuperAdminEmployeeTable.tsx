import { Eye, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { SuperAdminEmployee } from '../types/superAdminEmployee';
import UserAvatar from './UserAvatar';
import { getInitials } from '../utils/initials';
import './EmployeeTable.css';
import './EmployeeCards.css';

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
    <div className="table-card employee-cards">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Emp ID</th>
              <th scope="col">Employee Name</th>
              <th scope="col">Stores</th>
              <th scope="col">Contact</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
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
                      <UserAvatar
                        initials={getInitials(employee.name)}
                        src={employee.avatarUrl}
                        size={32}
                      />
                      {/* Mobile-only presence dot: green active, grey inactive. */}
                      <span
                        className={`employee-cards__status-dot${employee.active ? ' employee-cards__status-dot--active' : ''}`}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="employee-cards__name-text">{employee.name}</span>
                  </div>
                </td>
                <td className="employee-cards__stores" data-label="Stores">
                  {/* Mobile-only heading (hidden on desktop via CSS). */}
                  <span className="employee-cards__stores-heading">
                    <MapPin size={12} aria-hidden="true" />
                    {employee.stores.length === 1
                      ? 'Assigned Store'
                      : `Assigned Stores (${employee.stores.length})`}
                  </span>
                  {employee.stores.length === 0 ? (
                    <span className="employee-table__no-stores">—</span>
                  ) : (
                    <div className="employee-table__store-badges">
                      {employee.stores.map((store) => (
                        <span key={store.id} className="employee-table__store-badge">{store.name}</span>
                      ))}
                    </div>
                  )}
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
                      aria-label={`View details for ${employee.name}`}
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
