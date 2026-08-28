import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Employee, EmployeeType } from '../types/employee';
import { getShiftTimeRange } from '../utils/employeeUtils';
import RowActionsMenu from './RowActionsMenu';
import SearchInput from './SearchInput';
import PaginationBar from './PaginationBar';
import './EmployeeTable.css';

interface EmployeeTableProps {
  employees: Employee[];
  isLoading?: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

type SortKey = 'empId' | 'name' | 'storeName' | 'shift' | 'phone' | 'employeeType' | 'email' | 'gender';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'empId', label: 'Emp ID' },
  { key: 'name', label: 'Employee Name' },
  { key: 'storeName', label: 'Assigned Store' },
  { key: 'shift', label: 'Shift' },
  { key: 'phone', label: 'Contact' },
  { key: 'employeeType', label: 'Type' },
  { key: 'email', label: 'Email' },
  { key: 'gender', label: 'Gender' },
];

const SEARCHABLE_FIELDS: SortKey[] = ['name', 'email', 'storeName', 'phone', 'shift', 'employeeType', 'gender'];

function TypeBadge({ type }: { type: EmployeeType }) {
  const className = type === 'Full Time' ? 'badge badge--solid' : 'badge badge--outline';
  return <span className={className}>{type}</span>;
}

function EmployeeTable({ employees, isLoading = false, onEdit, onDelete }: EmployeeTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      SEARCHABLE_FIELDS.some((field) => String(employee[field]).toLowerCase().includes(query)),
    );
  }, [employees, searchQuery]);

  const sortedEmployees = useMemo(() => {
    if (!sortKey) return filteredEmployees;
    const sorted = [...filteredEmployees].sort((a, b) => {
      const result = String(a[sortKey]).localeCompare(String(b[sortKey]), undefined, {
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
              <td className="employee-table__emp-id">{employee.empId}</td>
              <td className="employee-table__name">{employee.name}</td>
              <td>{employee.storeName}</td>
              <td>
                <div className="employee-table__shift-name">{employee.shift}</div>
                <div className="employee-table__shift-range">
                  ({getShiftTimeRange(employee.shift)})
                </div>
              </td>
              <td>
                <a className="employee-table__link" href={`tel:${employee.phone}`}>
                  {employee.phone}
                </a>
              </td>
              <td>
                <TypeBadge type={employee.employeeType} />
              </td>
              <td>
                <a className="employee-table__link" href={`mailto:${employee.email}`}>
                  {employee.email}
                </a>
              </td>
              <td>{employee.gender}</td>
              <td className="employee-table__actions-cell">
                <RowActionsMenu onEdit={() => onEdit(employee)} onDelete={() => onDelete(employee)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
