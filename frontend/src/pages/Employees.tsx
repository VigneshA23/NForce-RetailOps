import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
<<<<<<< Updated upstream
import {
  createEmployee,
  deleteEmployee,
  getAssignableStores,
  getEmployees,
  updateEmployee,
} from '../api/employees';
import type { Employee, EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
=======
import { createEmployee, getEmployees, updateEmployee, updateEmployeeStatus } from '../api/employees';
import { getStores } from '../api/stores';
import type { Employee, EmployeeFormValues, StoreOption } from '../types/employee';
>>>>>>> Stashed changes
import EmployeeTable from '../components/EmployeeTable';
import EmployeeFormModal from '../components/EmployeeFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import './Employees.css';

interface EmployeesProps {
  token: string;
}

type FormModalState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

<<<<<<< Updated upstream
function toUpdateValues(employee: Employee): EmployeeUpdateValues {
  return {
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    shift: employee.shift,
    type: employee.type,
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
=======
function Employees({ token }: EmployeesProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getEmployees(token), getStores(token)])
      .then(([employeeList, storeList]) => {
        if (!isMounted) return;
        setEmployees(employeeList);
        setStores(storeList);
      })
      .catch(() => {
        if (isMounted) setError('Unable to load employees. Please refresh the page.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleFormSubmit(values: EmployeeFormValues) {
    setIsSubmitting(true);
    setError(null);
    try {
      if (formModalState?.mode === 'edit') {
        const updated = await updateEmployee(token, formModalState.employee.id, values);
        setEmployees((current) => current.map((employee) => (employee.id === updated.id ? updated : employee)));
      } else {
        const created = await createEmployee(token, values);
        setEmployees((current) => [...current, created]);
      }
      setFormModalState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save employee.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    setError(null);
    try {
      const updated = await updateEmployeeStatus(token, statusTarget.id, !statusTarget.active);
      setEmployees((current) => current.map((employee) => (employee.id === updated.id ? updated : employee)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update employee status.');
    } finally {
      setStatusTarget(null);
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
          onClick={() => {
            setFormError(null);
            setFormModalState({ mode: 'create' });
          }}
=======
          onClick={() => setFormModalState({ mode: 'create' })}
          disabled={stores.length === 0}
>>>>>>> Stashed changes
        >
          <span className="employees-page__add-label">
            <Plus size={16} />
            Add Employee
          </span>
        </SpecularButton>
      </div>

<<<<<<< Updated upstream
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
=======
      {error && <div className="employees-page__error">{error}</div>}

      <EmployeeTable
        employees={employees}
        isLoading={isLoading}
        onEdit={(employee) => setFormModalState({ mode: 'edit', employee })}
        onToggleStatus={(employee) => setStatusTarget(employee)}
      />
>>>>>>> Stashed changes

      <EmployeeFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
<<<<<<< Updated upstream
        initialValues={formModalState?.mode === 'edit' ? toUpdateValues(formModalState.employee) : undefined}
        storeOptions={storeOptions}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
=======
        stores={stores}
        initialValues={
          formModalState?.mode === 'edit'
            ? {
                name: formModalState.employee.name,
                email: formModalState.employee.email,
                password: '',
                phone: formModalState.employee.phone,
                shift: formModalState.employee.shift,
                type: formModalState.employee.type,
                gender: formModalState.employee.gender,
                storeId: formModalState.employee.storeId,
              }
            : undefined
        }
        onClose={() => (isSubmitting ? undefined : setFormModalState(null))}
>>>>>>> Stashed changes
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={statusTarget?.active ? 'Deactivate Employee' : 'Activate Employee'}
        message={
<<<<<<< Updated upstream
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
=======
          statusTarget
            ? statusTarget.active
              ? `Deactivate ${statusTarget.name} (${statusTarget.empId})? They will lose access until reactivated.`
              : `Reactivate ${statusTarget.name} (${statusTarget.empId})?`
            : ''
        }
        confirmLabel={statusTarget?.active ? 'Deactivate' : 'Activate'}
        danger={statusTarget?.active ?? false}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusTarget(null)}
>>>>>>> Stashed changes
      />
    </div>
  );
}

export default Employees;
