import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Employee, EmployeeType } from '../types/employee';
import { getShiftTimeRange } from '../utils/employeeUtils';
import RowActionsMenu from './RowActionsMenu';
import SearchInput from './SearchInput';
import PaginationBar from './PaginationBar';
import Toggle from './Toggle';
import './EmployeeTable.css';

interface EmployeeTableProps {
  employees: Employee[];
  isLoading?: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
}

type SortKey =
  | 'empId'
  | 'name'
  | 'stores'
  | 'shift'
  | 'phone'
  | 'employeeType'
  | 'email'
  | 'gender'
  | 'active';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'empId', label: 'Emp ID' },
  { key: 'name', label: 'Employee Name' },
  { key: 'stores', label: 'Assigned Stores' },
  { key: 'shift', label: 'Shift' },
  { key: 'phone', label: 'Contact' },
  { key: 'employeeType', label: 'Type' },
  { key: 'email', label: 'Email' },
  { key: 'gender', label: 'Gender' },
  { key: 'active', label: 'Status' },
];

const SEARCHABLE_FIELDS: SortKey[] = [
  'name',
  'email',
  'stores',
  'phone',
  'shift',
  'employeeType',
  'gender',
  'active',
];

function TypeBadge({ type }: { type: EmployeeType }) {
  const className = type === 'Full Time' ? 'badge badge--solid' : 'badge badge--outline';
  return <span className={className}>{type}</span>;
}

function statusLabel(employee: Employee): string {
  return employee.active ? 'Active' : 'Inactive';
}

function storeNames(employee: Employee): string {
  return employee.stores.map((store) => store.name).join(', ');
}

// Status sorts and searches on its rendered label rather than the raw boolean,
// so "inactive" matches in the search box and sorting reads alphabetically.
function fieldValue(employee: Employee, key: SortKey): string {
  if (key === 'stores') return storeNames(employee);
  if (key === 'active') return statusLabel(employee);
  return String(employee[key]);
}

function EmployeeTable({
  employees,
  isLoading = false,
  onEdit,
  onDelete,
  onToggleStatus,
}: EmployeeTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      SEARCHABLE_FIELDS.some((field) => fieldValue(employee, field).toLowerCase().includes(query)),
    );
  }, [employees, searchQuery]);

  const sortedEmployees = useMemo(() => {
    if (!sortKey) return filteredEmployees;
    const sorted = [...filteredEmployees].sort((a, b) => {
      const result = fieldValue(a, sortKey).localeCompare(fieldValue(b, sortKey), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      return sortDirection === 'asc' ? result : -result;
    });
    return sorted;
  }, [filteredEmployees, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedEmployees.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedEmployees = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedEmployees.slice(start, start + PAGE_SIZE);
  }, [sortedEmployees, safePage]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }

  return (
    <div className="employee-table__card">
      <div className="employee-table__toolbar">
        <SearchInput
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          placeholder="Search by name or email..."
        />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col">
                  <button
                    type="button"
                    className="employee-table__sort-btn"
                    onClick={() => handleSort(column.key)}
                  >
                    {column.label}
                    {sortKey === column.key ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )
                    ) : (
                      <ArrowUpDown size={14} className="employee-table__sort-icon--idle" />
                    )}
                  </button>
                </th>
              ))}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployees.map((employee) => (
              <tr key={employee.empId}>
                <td className="employee-table__emp-id" data-label="Emp ID">{employee.empId}</td>
                <td className="employee-table__name" data-label="Employee Name">{employee.name}</td>
                <td data-label="Assigned Stores">
                  <div className="employee-table__store-chips">
                    {employee.stores.map((store) => (
                      <span key={store.id} className="badge badge--outline">
                        {store.name}
                      </span>
                    ))}
                  </div>
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
                  <div className="employee-table__status">
                    <span className={`badge ${employee.active ? 'badge--solid' : 'badge--outline'}`}>
                      {statusLabel(employee)}
                    </span>
                    <Toggle
                      checked={employee.active}
                      onChange={() => onToggleStatus(employee)}
                      label={`${employee.active ? 'Deactivate' : 'Activate'} ${employee.name}`}
                    />
                  </div>
                </td>
                <td className="employee-table__actions-cell" data-label="Actions">
                  <RowActionsMenu onEdit={() => onEdit(employee)} onDelete={() => onDelete(employee)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && employees.length === 0 && (
        <div className="employee-table__empty">No employees yet. Add one to get started.</div>
      )}
      {!isLoading && employees.length > 0 && sortedEmployees.length === 0 && (
        <div className="employee-table__empty">No employees match your search.</div>
      )}
      {isLoading && <div className="employee-table__empty">Loading employees...</div>}
      {!isLoading && sortedEmployees.length > 0 && (
        <div className="employee-table__pagination">
          <PaginationBar
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={sortedEmployees.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}

export default EmployeeTable;
