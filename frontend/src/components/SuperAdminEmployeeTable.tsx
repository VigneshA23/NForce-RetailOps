import type { SuperAdminEmployee } from '../types/superAdminEmployee';
import './EmployeeTable.css';

interface SuperAdminEmployeeTableProps {
  employees: SuperAdminEmployee[];
  isLoading?: boolean;
  emptyMessage?: string;
  onViewDetails: (employee: SuperAdminEmployee) => void;
}

function SuperAdminEmployeeTable({
  employees,
  isLoading = false,
  emptyMessage = 'No employees match your filters.',
  onViewDetails,
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
                  <span className={`badge ${employee.active ? 'badge--solid' : 'badge--outline'}`}>
                    {employee.active ? 'Active' : 'Inactive'}
                  </span>
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
