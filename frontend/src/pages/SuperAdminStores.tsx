import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CircleCheck, Plus, Store as StoreIcon, Users } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { createStandaloneStore, deleteStore, getAllStores, updateStoreStatus } from '../api/superAdminStores';
import type { CreateStoreValues, SuperAdminStore } from '../types/superAdminStore';
import SuperAdminStoreTable from '../components/SuperAdminStoreTable';
import SuperAdminStoreDetail from './SuperAdminStoreDetail';
import AddStoreModal from '../components/AddStoreModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './SuperAdminStores.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type CountComparator = 'ANY' | 'GT' | 'LT' | 'EQ';

const PAGE_SIZE = 10;

// Any comparator whose value box is empty or non-numeric doesn't filter --
// only an actually-entered number narrows the results.
function matchesCount(count: number, comparator: CountComparator, rawValue: string): boolean {
  if (comparator === 'ANY') return true;
  const value = Number(rawValue);
  if (rawValue.trim() === '' || Number.isNaN(value)) return true;
  if (comparator === 'GT') return count > value;
  if (comparator === 'LT') return count < value;
  return count === value;
}

function SuperAdminStores() {
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<SuperAdminStore | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminStore | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [employeeComparator, setEmployeeComparator] = useState<CountComparator>('ANY');
  const [employeeValue, setEmployeeValue] = useState('');
  const [taskComparator, setTaskComparator] = useState<CountComparator>('ANY');
  const [taskValue, setTaskValue] = useState('');
  const [page, setPage] = useState(1);

  function loadStores() {
    setIsLoading(true);
    setLoadError(null);
    getAllStores()
      .then(setStores)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadStores();
  }, []);

  async function handleFormSubmit(values: CreateStoreValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const created = await createStandaloneStore(values);
      setStores((current) => [created, ...current]);
      setIsFormOpen(false);
      nfToast.success(`"${values.name}" store added.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(store: SuperAdminStore) {
    setStatusError(null);
    const nextActive = !store.storeActive;
    // Optimistic update so the toggle responds immediately; reverted below on failure.
    setStores((current) =>
      current.map((s) => (s.storeId === store.storeId ? { ...s, storeActive: nextActive } : s)),
    );
    try {
      const updated = await updateStoreStatus(store.storeId, nextActive);
      setStores((current) => current.map((s) => (s.storeId === updated.storeId ? updated : s)));
      nfToast.success(`"${updated.storeName}" store ${updated.storeActive ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setStores((current) =>
        current.map((s) => (s.storeId === store.storeId ? { ...s, storeActive: store.storeActive } : s)),
      );
      const msg = error instanceof Error ? error.message : 'Failed to update store status';
      setStatusError(msg);
      nfToast.error(msg);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteStore(deleteTarget.storeId);
      setStores((current) => current.filter((s) => s.storeId !== deleteTarget.storeId));
      const deletedName = deleteTarget.storeName;
      setDeleteTarget(null);
      nfToast.success(`"${deletedName}" store deleted.`);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete store');
    }
  }

  const filteredStores = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stores.filter((store) => {
      if (
        query &&
        !store.storeName.toLowerCase().includes(query) &&
        !String(store.storeCode).includes(query) &&
        !(store.ownerName?.toLowerCase().includes(query) ?? false)
      ) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && !store.storeActive) return false;
      if (statusFilter === 'INACTIVE' && store.storeActive) return false;
      if (!matchesCount(store.employeeCount, employeeComparator, employeeValue)) return false;
      if (!matchesCount(store.taskCount, taskComparator, taskValue)) return false;
      return true;
    });
  }, [stores, search, statusFilter, employeeComparator, employeeValue, taskComparator, taskValue]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, employeeComparator, employeeValue, taskComparator, taskValue]);

  const pageCount = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedStores = filteredStores.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Stat cards always summarize every store, not just the filtered/paged subset.
  const activeCount = useMemo(() => stores.filter((store) => store.storeActive).length, [stores]);
  const totalEmployeeCount = useMemo(
    () => stores.reduce((sum, store) => sum + store.employeeCount, 0),
    [stores],
  );

  if (selectedStore) {
    return <SuperAdminStoreDetail store={selectedStore} onBack={() => setSelectedStore(null)} />;
  }

  return (
    <div className="super-admin-stores-page">
      <div className="stat-card-row">
        <StatCard icon={StoreIcon} label="Total Stores" value={stores.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active Stores" value={activeCount} tone="success" />
        <StatCard icon={Users} label="Total Employees" value={totalEmployeeCount} tone="info" />
      </div>

      <div className="super-admin-stores-page__header">
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
          <span className="super-admin-stores-page__add-label">
            <Plus size={16} />
            Add Store
          </span>
        </SpecularButton>
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by store, ID, or owner" />
        </div>

        <select
          className="select filter filter--narrow"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <div className="filter super-admin-stores-page__count-filter">
          <select
            className="select"
            value={employeeComparator}
            onChange={(event) => setEmployeeComparator(event.target.value as CountComparator)}
            aria-label="Employees filter"
          >
            <option value="ANY">Employees: Any</option>
            <option value="GT">Employees &gt;</option>
            <option value="LT">Employees &lt;</option>
            <option value="EQ">Employees =</option>
          </select>
          <input
            type="number"
            min={0}
            className="input"
            value={employeeValue}
            onChange={(event) => setEmployeeValue(event.target.value)}
            disabled={employeeComparator === 'ANY'}
            placeholder="0"
            aria-label="Employees count"
          />
        </div>

        <div className="filter super-admin-stores-page__count-filter">
          <select
            className="select"
            value={taskComparator}
            onChange={(event) => setTaskComparator(event.target.value as CountComparator)}
            aria-label="Tasks filter"
          >
            <option value="ANY">Tasks: Any</option>
            <option value="GT">Tasks &gt;</option>
            <option value="LT">Tasks &lt;</option>
            <option value="EQ">Tasks =</option>
          </select>
          <input
            type="number"
            min={0}
            className="input"
            value={taskValue}
            onChange={(event) => setTaskValue(event.target.value)}
            disabled={taskComparator === 'ANY'}
            placeholder="0"
            aria-label="Tasks count"
          />
        </div>
      </div>

      {statusError && (
        <div className="super-admin-stores-page__error">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{statusError}</span>
        </div>
      )}

      {loadError ? (
        <div className="super-admin-stores-page__error">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{loadError}</span>
          <button type="button" className="btn btn--secondary" onClick={loadStores}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <SuperAdminStoreTable
            stores={pagedStores}
            isLoading={isLoading}
            emptyMessage={stores.length === 0 ? 'No stores yet.' : 'No stores match your filters.'}
            onViewDetails={setSelectedStore}
            onToggleStatus={handleToggleStatus}
            onDelete={(store) => {
              setDeleteError(null);
              setDeleteTarget(store);
            }}
          />
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            totalItems={filteredStores.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <AddStoreModal
        isOpen={isFormOpen}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Store"
        message={
          deleteTarget
            ? `Permanently delete "${deleteTarget.storeName}"? This cannot be undone.${
                deleteError ? ` ${deleteError}` : ''
              }`
            : ''
        }
        confirmLabel="Delete Store"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteError(null);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export default SuperAdminStores;
