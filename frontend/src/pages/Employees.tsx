import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Plus, Users, UserCheck, UserCog, UserX } from 'lucide-react';
import {
  createEmployee,
  deleteEmployee,
  getAssignableStores,
  resetEmployeePassword,
  setEmployeeStatus,
  updateEmployee,
} from '../api/employees';
import type {
  Employee,
  EmployeeCreateValues,
  EmployeeType,
  EmployeeUpdateValues,
  ShiftName,
  StoreOption,
} from '../types/employee';
import { EMPLOYEE_TYPE_OPTIONS, SHIFT_OPTIONS } from '../utils/employeeOptions';
import { toEmployeeUpdateValues } from '../utils/employeeUtils';
import EmployeeTable from '../components/EmployeeTable';
import EmployeeFormModal from '../components/EmployeeFormModal';
import EmployeeDetailModal from '../components/EmployeeDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './Employees.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type FormModalState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

const PAGE_SIZE = 10;

interface EmployeesProps {
  employees: Employee[];
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  employeesLoading: boolean;
  employeesError: string | null;
  onRetryEmployees: () => void;
}

function Employees({ employees, setEmployees, employeesLoading, employeesError, onRetryEmployees }: EmployeesProps) {
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [storeOptionsLoading, setStoreOptionsLoading] = useState(true);
  const [storeOptionsError, setStoreOptionsError] = useState<string | null>(null);

  const isLoading = employeesLoading || storeOptionsLoading;
  const loadError = employeesError ?? storeOptionsError;

  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<number | 'ALL'>('ALL');
  const [shiftFilter, setShiftFilter] = useState<ShiftName | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<EmployeeType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<Employee | null>(null);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [detailTarget, setDetailTarget] = useState<Employee | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  function loadStoreOptions() {
    setStoreOptionsLoading(true);
    setStoreOptionsError(null);
    getAssignableStores()
      .then(setStoreOptions)
      .catch((error: Error) => setStoreOptionsError(error.message))
      .finally(() => setStoreOptionsLoading(false));
  }

  useEffect(() => {
    loadStoreOptions();
  }, []);

  function retryLoad() {
    onRetryEmployees();
    loadStoreOptions();
  }

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return employees.filter((employee) => {
      // Store, shift, type and status each have their own dropdown now, so the
      // search box covers only the free-text identity fields.
      if (
        normalizedSearch &&
        ![employee.name, employee.empId, employee.email, employee.phone].some((field) =>
          field.toLowerCase().includes(normalizedSearch),
        )
      ) {
        return false;
      }
      if (storeFilter !== 'ALL' && !employee.stores.some((store) => store.id === storeFilter)) return false;
      if (shiftFilter !== 'ALL' && employee.shift !== shiftFilter) return false;
      if (typeFilter !== 'ALL' && employee.employeeType !== typeFilter) return false;
      if (statusFilter === 'ACTIVE' && !employee.active) return false;
      if (statusFilter === 'INACTIVE' && employee.active) return false;
      return true;
    });
  }, [employees, search, storeFilter, shiftFilter, typeFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, storeFilter, shiftFilter, typeFilter, statusFilter]);

  // Derived rather than clamped in an effect, so a filter that shrinks the list
  // below the current page still renders correctly on the same pass.
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
      setSuccessMessage('Employee deleted successfully.');
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
      setSuccessMessage(`${updated.name} is now ${updated.active ? 'active' : 'inactive'}.`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to update employee status');
      setStatusTarget(null);
    }
  }

  async function handleConfirmResetPassword() {
    if (!resetPasswordTarget) return;
    setResetPasswordError(null);
    setIsResettingPassword(true);
    try {
      await resetEmployeePassword(resetPasswordTarget.id);
      setSuccessMessage(`Reset password email sent to ${resetPasswordTarget.name}.`);
      setResetPasswordTarget(null);
    } catch (error) {
      setResetPasswordError(error instanceof Error ? error.message : "Failed to reset the employee's password");
    } finally {
      setIsResettingPassword(false);
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

  const storeCoverageCount = useMemo(() => {
    const storeIds = new Set<number>();
    employees.forEach((employee) => employee.stores.forEach((store) => storeIds.add(store.id)));
    return storeIds.size;
  }, [employees]);

  const activeCount = employees.length - inactiveCount;

  const summaryText = isLoading
    ? 'Loading employees...'
    : `${activeCount} active employee${activeCount === 1 ? '' : 's'} across ${storeCoverageCount} store${storeCoverageCount === 1 ? '' : 's'}`;

  const emptyMessage =
    employees.length === 0
      ? 'No employees yet. Add one to get started.'
      : 'No employees match your filters.';

  return (
    <div className="employees-page">
      <div className="stat-card-row">
        <StatCard icon={Users} label="Total Employees" value={employees.length} tone="primary" />
        <StatCard icon={UserCheck} label="Full Time" value={fullTimeCount} tone="success" />
        <StatCard icon={UserCog} label="Part Time" value={employees.length - fullTimeCount} tone="info" />
        <StatCard icon={UserX} label="Inactive" value={inactiveCount} tone="warning" />
      </div>

      <div className="employees-page__header">
        <p className="employees-page__summary">{summaryText}</p>

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

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employees" />
        </div>

        <select
          className="select filter"
          value={storeFilter}
          onChange={(event) => setStoreFilter(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))}
        >
          <option value="ALL">All Stores</option>
          {storeOptions.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>

        <select
          className="select filter"
          value={shiftFilter}
          onChange={(event) => setShiftFilter(event.target.value as ShiftName | 'ALL')}
        >
          <option value="ALL">All Shifts</option>
          {SHIFT_OPTIONS.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>

        <select
          className="select filter"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as EmployeeType | 'ALL')}
        >
          <option value="ALL">All Types</option>
          {EMPLOYEE_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          className="select filter filter--narrow"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {successMessage && <div className="employees-page__success">{successMessage}</div>}
      {statusError && <div className="employees-page__error">{statusError}</div>}

      {loadError ? (
        <div className="employees-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={retryLoad}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <EmployeeTable
            employees={pagedEmployees}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
            onViewDetails={(employee) => setDetailTarget(employee)}
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
            onResetPassword={(employee) => {
              setResetPasswordError(null);
              setResetPasswordTarget(employee);
            }}
          />
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            totalItems={filteredEmployees.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <EmployeeFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialValues={formModalState?.mode === 'edit' ? toEmployeeUpdateValues(formModalState.employee) : undefined}
        storeOptions={storeOptions}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
      />

      <EmployeeDetailModal employee={detailTarget} onClose={() => setDetailTarget(null)} />

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

      <ConfirmDialog
        isOpen={resetPasswordTarget !== null}
        title="Reset Password"
        message={
          resetPasswordTarget
            ? `Reset the password for ${resetPasswordTarget.name} (${resetPasswordTarget.empId})? A new temporary password will be emailed to them and they will be signed out of any active session.${
                resetPasswordError ? ` ${resetPasswordError}` : ''
              }`
            : ''
        }
        confirmLabel={isResettingPassword ? 'Sending...' : 'Send Reset Email'}
        danger={false}
        onConfirm={handleConfirmResetPassword}
        onCancel={() => {
          setResetPasswordError(null);
          setResetPasswordTarget(null);
        }}
      />
    </div>
  );
}

export default Employees;
