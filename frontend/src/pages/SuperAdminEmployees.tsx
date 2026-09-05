import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, UserCheck, UserCog, UserX, Users } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { createEmployeeAsSuperAdmin, getAllEmployeesForSuperAdmin } from '../api/superAdminEmployees';
import { deleteEmployee, setEmployeeStatus, updateEmployee } from '../api/employees';
import type { SuperAdminEmployee } from '../types/superAdminEmployee';
import type { EmployeeCreateValues, EmployeeType, EmployeeUpdateValues, ShiftName } from '../types/employee';
import { toEmployeeUpdateValues } from '../utils/employeeUtils';
import { EMPLOYEE_TYPE_OPTIONS, SHIFT_OPTIONS } from '../utils/employeeOptions';
import SuperAdminEmployeeTable from '../components/SuperAdminEmployeeTable';
import EmployeeFormModal from '../components/EmployeeFormModal';
import EmployeeDetailModal from '../components/EmployeeDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import TemporaryPasswordPopup from '../components/TemporaryPasswordPopup';
import SearchInput from '../components/SearchInput';
import SpecularButton from '../components/SpecularButton';
import Pagination from '../components/Pagination';
import StatCard from '../components/StatCard';
import './SuperAdminEmployees.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const PAGE_SIZE = 10;

function SuperAdminEmployees() {
  const [employees, setEmployees] = useState<SuperAdminEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState<ShiftName | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<EmployeeType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const [detailTarget, setDetailTarget] = useState<SuperAdminEmployee | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SuperAdminEmployee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminEmployee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<SuperAdminEmployee | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  function loadEmployees() {
    setIsLoading(true);
    setLoadError(null);
    getAllEmployeesForSuperAdmin()
      .then(setEmployees)
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
      if (editTarget) {
        await updateEmployee(editTarget.id, values as EmployeeUpdateValues);
        setEditTarget(null);
        loadEmployees();
        nfToast.success(`"${(values as EmployeeUpdateValues).name}" employee updated.`);
      } else {
        const created = await createEmployeeAsSuperAdmin(values as EmployeeCreateValues);
        setIsFormOpen(false);
        loadEmployees();
        nfToast.success(`"${created.employee.name}" employee added.`);
        setTempPassword({ name: created.employee.name, password: created.temporaryPassword });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    setStatusError(null);
    try {
      await setEmployeeStatus(statusTarget.id, !statusTarget.active);
      const nextActive = !statusTarget.active;
      setStatusTarget(null);
      loadEmployees();
      nfToast.success(`"${statusTarget.name}" employee ${nextActive ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to update employee status');
      setStatusTarget(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteEmployee(deleteTarget.id);
      setEmployees((current) => current.filter((e) => e.id !== deleteTarget.id));
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      nfToast.success(`"${deletedName}" permanently deleted.`);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete employee');
    }
  }

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (
        normalizedSearch &&
        ![employee.name, employee.empId, employee.email, employee.phone, employee.ownerName].some((field) =>
          field.toLowerCase().includes(normalizedSearch),
        )
      ) {
        return false;
      }
      if (shiftFilter !== 'ALL' && employee.shift !== shiftFilter) return false;
      if (typeFilter !== 'ALL' && employee.employeeType !== typeFilter) return false;
      if (statusFilter === 'ACTIVE' && !employee.active) return false;
      if (statusFilter === 'INACTIVE' && employee.active) return false;
      return true;
    });
  }, [employees, search, shiftFilter, typeFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, shiftFilter, typeFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const fullTimeCount = useMemo(
    () => employees.filter((employee) => employee.employeeType === 'Full Time').length,
    [employees],
  );
  const inactiveCount = useMemo(() => employees.filter((employee) => !employee.active).length, [employees]);

  const emptyMessage =
    employees.length === 0 ? 'No employees yet.' : 'No employees match your filters.';

  return (
    <div className="super-admin-employees-page">
      <div className="stat-card-row">
        <StatCard icon={Users} label="Total Employees" value={employees.length} tone="primary" />
        <StatCard icon={UserCheck} label="Full Time" value={fullTimeCount} tone="success" />
        <StatCard icon={UserCog} label="Part Time" value={employees.length - fullTimeCount} tone="info" />
        <StatCard icon={UserX} label="Inactive" value={inactiveCount} tone="warning" />
      </div>

      <div className="super-admin-employees-page__header">
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
            setIsFormOpen(true);
          }}
        >
          <span className="super-admin-employees-page__add-label">
            <Plus size={16} />
            Add Employee
          </span>
        </SpecularButton>
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employees or owners" />
        </div>

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

      {loadError ? (
        <div className="super-admin-employees-page__error">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{loadError}</span>
          <button type="button" className="btn btn--secondary" onClick={loadEmployees}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <SuperAdminEmployeeTable
            employees={pagedEmployees}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
            onViewDetails={setDetailTarget}
            onEdit={(employee) => {
              setFormError(null);
              setEditTarget(employee);
            }}
            onToggleStatus={(employee) => {
              setStatusError(null);
              setStatusTarget(employee);
            }}
            onDelete={(employee) => {
              setDeleteError(null);
              setDeleteTarget(employee);
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

      <EmployeeDetailModal
        employee={detailTarget}
        ownerName={detailTarget?.ownerName}
        onClose={() => setDetailTarget(null)}
      />

      <EmployeeFormModal
        isOpen={isFormOpen}
        mode="create"
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <EmployeeFormModal
        isOpen={editTarget !== null}
        mode="edit"
        initialValues={editTarget ? toEmployeeUpdateValues(editTarget) : undefined}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setEditTarget(null)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={statusTarget?.active ? 'Deactivate Employee' : 'Activate Employee'}
        message={
          statusTarget
            ? statusTarget.active
              ? `Deactivate ${statusTarget.name} (${statusTarget.empId})? They will be signed out immediately and will not be able to sign in again until reactivated.${statusError ? ` ${statusError}` : ''}`
              : `Reactivate ${statusTarget.name} (${statusTarget.empId})? They will be able to sign in again.`
            : ''
        }
        confirmLabel={statusTarget?.active ? 'Deactivate' : 'Activate'}
        danger={statusTarget?.active ?? true}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Permanently Delete Employee"
        message={
          deleteTarget
            ? `This permanently deletes ${deleteTarget.name} (${deleteTarget.empId})'s account and removes them from all stores. This cannot be undone.${
                deleteError ? ` ${deleteError}` : ''
              }`
            : ''
        }
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteError(null);
          setDeleteTarget(null);
        }}
      />

      <TemporaryPasswordPopup
        isOpen={tempPassword !== null}
        name={tempPassword?.name}
        password={tempPassword?.password ?? null}
        onClose={() => setTempPassword(null)}
      />
    </div>
  );
}

export default SuperAdminEmployees;
