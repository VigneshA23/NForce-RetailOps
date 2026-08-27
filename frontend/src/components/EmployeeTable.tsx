import type { Employee, EmployeeType } from '../types/employee';
import { getShiftTimeRange } from '../utils/employeeUtils';
import RowActionsMenu from './RowActionsMenu';
import './EmployeeTable.css';

interface EmployeeTableProps {
  employees: Employee[];
  isLoading?: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

function TypeBadge({ type }: { type: EmployeeType }) {
  const className = type === 'Full Time' ? 'badge badge--solid' : 'badge badge--outline';
  return <span className={className}>{type}</span>;
}

function EmployeeTable({ employees, isLoading = false, onEdit, onDelete }: EmployeeTableProps) {
  return (
    <div className="employee-table__card">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Emp ID</th>
            <th scope="col">Employee Name</th>
            <th scope="col">Assigned Store</th>
            <th scope="col">Shift</th>
            <th scope="col">Contact</th>
            <th scope="col">Type</th>
            <th scope="col">Email</th>
            <th scope="col">Gender</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.empId}>
              <td className="employee-table__emp-id">{employee.empId}</td>
              <td className="employee-table__name">{employee.name}</td>
              <td>{employee.store}</td>
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
                <TypeBadge type={employee.type} />
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
      {isLoading && <div className="employee-table__empty">Loading employees...</div>}
    </div>
  );
}

export default EmployeeTable;
