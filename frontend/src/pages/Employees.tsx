import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { getEmployees } from '../api/employees';
import type { Employee, EmployeeFormValues } from '../types/employee';
import { getNextEmpId } from '../utils/employeeUtils';
import EmployeeTable from '../components/EmployeeTable';
import EmployeeFormModal from '../components/EmployeeFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import './Employees.css';

type FormModalState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  useEffect(() => {
    let isMounted = true;
    getEmployees().then((data) => {
      if (isMounted) {
        setEmployees(data);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  function handleFormSubmit(values: EmployeeFormValues) {
    if (formModalState?.mode === 'edit') {
      const { empId } = formModalState.employee;
      setEmployees((current) =>
        current.map((employee) => (employee.empId === empId ? { ...values, empId } : employee)),
      );
    } else {
      const empId = getNextEmpId(employees);
      setEmployees((current) => [...current, { ...values, empId }]);
    }
    setFormModalState(null);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    setEmployees((current) => current.filter((employee) => employee.empId !== deleteTarget.empId));
    setDeleteTarget(null);
  }

  return (
    <div className="employees-page">
      <div className="employees-page__toolbar">
        <SpecularButton
          size="sm"
          radius={999}
          tint="var(--color-badge-solid-bg)"
          tintOpacity={1}
          textColor="var(--color-badge-solid-text)"
          lineColor="#e11d33"
          baseColor="#e4e4e7"
          followMouse
          proximity={180}
          onClick={() => setFormModalState({ mode: 'create' })}
        >
          <span className="employees-page__add-label">
            <Plus size={16} />
            Add Employee
          </span>
        </SpecularButton>
      </div>

      <EmployeeTable
        employees={employees}
        isLoading={isLoading}
        onEdit={(employee) => setFormModalState({ mode: 'edit', employee })}
        onDelete={(employee) => setDeleteTarget(employee)}
      />

      <EmployeeFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialValues={formModalState?.mode === 'edit' ? formModalState.employee : undefined}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Employee"
        message={
          deleteTarget
            ? `Are you sure you want to remove ${deleteTarget.name} (${deleteTarget.empId})? This cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default Employees;
