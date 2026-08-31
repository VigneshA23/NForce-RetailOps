import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, UserCheck, UserCog, UserX } from 'lucide-react';
import {
  createEmployee,
  deleteEmployee,
  getAssignableStores,
  getEmployees,
  setEmployeeStatus,
  updateEmployee,
} from '../api/employees';
import type { Employee, EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import EmployeeTable from '../components/EmployeeTable';
import EmployeeFormModal from '../components/EmployeeFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
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
    storeIds: employee.stores.map((store) => store.id),
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
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    setStatusError(null);
    try {
      const updated = await setEmployeeStatus(statusTarget.id, !statusTarget.active);
      setEmployees((current) => current.map((e) => (e.id === updated.id ? updated : e)));
      setStatusTarget(null);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to update employee status');
      setStatusTarget(null);
    }
  }

  const fullTimeCount = useMemo(
    () => employees.filter((employee) => employee.employeeType === 'Full Time').length,
    [employees],
  );

  const inactiveCount = useMemo(
    () => employees.filter((employee) => !employee.active).length,
    [employees],
  );

  return (
    <div className="employees-page">
      <div className="stat-card-row">
        <StatCard icon={Users} label="Total Employees" value={employees.length} tone="primary" />
        <StatCard icon={UserCheck} label="Full Time" value={fullTimeCount} tone="success" />
        <StatCard icon={UserCog} label="Part Time" value={employees.length - fullTimeCount} tone="info" />
        <StatCard icon={UserX} label="Inactive" value={inactiveCount} tone="warning" />
      </div>

      {statusError && <div className="employees-page__error">{statusError}</div>}

      {loadError ? (
        <div className="employees-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={loadEmployees}>
            Retry
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">All Employees</h2>
            <div className="card__toolbar">
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
          </div>
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
            onToggleStatus={(employee) => {
              setStatusError(null);
              setStatusTarget(employee);
            }}
          />
        </div>
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

      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={statusTarget?.active ? 'Deactivate Employee' : 'Activate Employee'}
        message={
          statusTarget
            ? statusTarget.active
              ? `Deactivate ${statusTarget.name} (${statusTarget.empId})? They will be signed out immediately and will not be able to sign in again until reactivated.`
              : `Reactivate ${statusTarget.name} (${statusTarget.empId})? They will be able to sign in again.`
            : ''
        }
        confirmLabel={statusTarget?.active ? 'Deactivate' : 'Activate'}
        danger={statusTarget?.active ?? true}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
}

export default Employees;
