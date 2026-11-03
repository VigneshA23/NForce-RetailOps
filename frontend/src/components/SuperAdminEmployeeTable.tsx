import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Eye, Pencil, Trash2 } from 'lucide-react';
import type { SuperAdminEmployee } from '../types/superAdminEmployee';
import UserAvatar from './UserAvatar';
import StoreChip from './StoreChip';
import { getInitials } from '../utils/initials';
import './EmployeeTable.css';
import './EmployeeCards.css';
import LoadingSkeleton from './LoadingSkeleton';

interface SuperAdminEmployeeTableProps {
  employees: SuperAdminEmployee[];
  isLoading?: boolean;
  emptyMessage?: string;
  onViewDetails: (employee: SuperAdminEmployee) => void;
  onEdit: (employee: SuperAdminEmployee) => void;
  onToggleStatus: (employee: SuperAdminEmployee) => void;
  onDelete: (employee: SuperAdminEmployee) => void;
  /** Rendered inside the card, below the rows (the page's pagination). */
  footer?: ReactNode;
}

function SuperAdminEmployeeTable({
  employees,
  isLoading = false,
  emptyMessage = 'No employees match your filters.',
  onViewDetails,
  onEdit,
  onToggleStatus,
  onDelete,
  footer,
}: SuperAdminEmployeeTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<SuperAdminEmployee['id']>>(new Set());

  function toggleExpanded(id: SuperAdminEmployee['id']) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="table-card employee-table__card employee-cards">
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
              <Fragment key={employee.id}>
              <tr>
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
                    {employee.stores.length === 1
                      ? 'Assigned Store'
                      : `Assigned Stores (${employee.stores.length})`}
                  </span>
                  {employee.stores.length === 0 ? (
                    <span className="employee-table__no-stores">—</span>
                  ) : (
                    <>
                      {/* Desktop: first store plus a "+N more" toggle. */}
                      <div className="store-summary employee-cards__desktop-only">
                        <StoreChip name={employee.stores[0].name} />
                        {employee.stores.length > 1 && (
                          <button
                            type="button"
                            className="store-more-toggle"
                            aria-expanded={expandedIds.has(employee.id)}
                            onClick={() => toggleExpanded(employee.id)}
                          >
                            +{employee.stores.length - 1} more
                            <ChevronDown size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {/* Mobile: every store, as before. */}
                      <div className="employee-table__store-badges employee-cards__mobile-only">
                        {employee.stores.map((store) => (
                          <StoreChip key={store.id} name={store.name} />
                        ))}
                      </div>
                    </>
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
              {expandedIds.has(employee.id) && (
                <tr className="store-expand-row">
                  <td colSpan={6}>
                    <div className="store-expand-panel">
                      <div className="store-expand-panel__heading">Assigned Stores · {employee.stores.length}</div>
                      <div className="store-expand-panel__list">
                        {employee.stores.map((store) => (
                          <StoreChip key={store.id} name={store.name} />
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && employees.length === 0 && <div className="table-card__empty">{emptyMessage}</div>}
      {isLoading && <LoadingSkeleton label="Loading employees..." variant="table" />}
      {footer && <div className="employee-table__footer">{footer}</div>}
    </div>
  );
}

export default SuperAdminEmployeeTable;
