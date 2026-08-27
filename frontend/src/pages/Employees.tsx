import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  createEmployee,
  deleteEmployee,
  getAssignableStores,
  getEmployees,
  updateEmployee,
} from '../api/employees';
import type { Employee, EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import EmployeeTable from '../components/EmployeeTable';
import EmployeeFormModal from '../components/EmployeeFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import './Employees.css';

type FormModalState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

function toUpdateValues(employee: Employee): EmployeeUpdateValues {
  return {
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    shift: employee.shift,
    employeeType: employee.employeeType,
    gender: employee.gender,
    storeId: employee.storeId,
  };
}

function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function loadEmployees() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getEmployees(), getAssignableStores()])
      .then(([employeeList, stores]) => {
        setEmployees(employeeList);
        setStoreOptions(stores);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  async function handleFormSubmit(values: EmployeeCreateValues | EmployeeUpdateValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formModalState?.mode === 'edit') {
        const updated = await updateEmployee(formModalState.employee.id, values as EmployeeUpdateValues);
        setEmployees((current) => current.map((e) => (e.id === updated.id ? updated : e)));
      } else {
        const created = await createEmployee(values as EmployeeCreateValues);
        setEmployees((current) => [...current, created]);
      }
      setFormModalState(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteEmployee(deleteTarget.id);
      setEmployees((current) => current.filter((employee) => employee.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete employee');
    }
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
          onClick={() => {
            setFormError(null);
            setFormModalState({ mode: 'create' });
          }}
        >
          <span className="employees-page__add-label">
            <Plus size={16} />
            Add Employee
          </span>
        </SpecularButton>
      </div>

      {loadError ? (
        <div className="employees-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={loadEmployees}>
            Retry
          </button>
        </div>
      ) : (
        <EmployeeTable
          employees={employees}
          isLoading={isLoading}
          onEdit={(employee) => {
            setFormError(null);
            setFormModalState({ mode: 'edit', employee });
          }}
          onDelete={(employee) => {
            setDeleteError(null);
            setDeleteTarget(employee);
          }}
        />
      )}

      <EmployeeFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialValues={formModalState?.mode === 'edit' ? toUpdateValues(formModalState.employee) : undefined}
        storeOptions={storeOptions}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Employee"
        message={
          deleteTarget
            ? `Are you sure you want to remove ${deleteTarget.name} (${deleteTarget.empId})? This cannot be undone.${
                deleteError ? ` ${deleteError}` : ''
              }`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteError(null);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export default Employees;
