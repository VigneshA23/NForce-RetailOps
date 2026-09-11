import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CircleCheck, Plus, Store as StoreIcon, Users } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { assignStoreOwner, createStandaloneStore, deleteStore, getAllStores, updateStore, updateStoreStatus } from '../api/superAdminStores';
import { getOwners } from '../api/owners';
import type { OwnerSummary } from '../types/owner';
import type { CreateStoreValues, SuperAdminStore } from '../types/superAdminStore';
import SuperAdminStoreTable from '../components/SuperAdminStoreTable';
import AddStoreModal from '../components/AddStoreModal';
import EditStoreModal from '../components/EditStoreModal';
import AssignStoreOwnerModal from '../components/AssignStoreOwnerModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './SuperAdminStores.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const PAGE_SIZE = 10;

interface SuperAdminStoresProps {
  onNavigateToChecklist: (storeId: number) => void;
}

function SuperAdminStores({ onNavigateToChecklist }: SuperAdminStoresProps) {
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminStore | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit-store modal
  const [editTarget, setEditTarget] = useState<SuperAdminStore | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Assign-owner modal
  const [assignTarget, setAssignTarget] = useState<SuperAdminStore | null>(null);
  const [allOwners, setAllOwners] = useState<OwnerSummary[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
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
    getOwners().then(setAllOwners).catch(() => {});
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

  async function handleEditSubmit(values: CreateStoreValues) {
    if (!editTarget) return;
    setEditError(null);
    setIsEditing(true);
    try {
      const updated = await updateStore(editTarget.storeId, values);
      setStores((current) => current.map((s) => (s.storeId === updated.storeId ? updated : s)));
      setEditTarget(null);
      nfToast.success(`"${updated.storeName}" store updated.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update store';
      setEditError(msg);
      nfToast.error(msg);
    } finally {
      setIsEditing(false);
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

  // Owners available to assign: those without an active store.
  // A store with storeActive=null means there's no active StoreOwner record for that owner.
  const availableOwners = useMemo(
    () => allOwners.filter((o) => o.ownerActive && (o.storeId === null || o.storeActive !== true)),
    [allOwners],
  );

  async function handleAssignOwner(ownerId: number) {
    if (!assignTarget) return;
    setAssignError(null);
    setIsAssigning(true);
    try {
      const updated = await assignStoreOwner(assignTarget.storeId, ownerId);
      setStores((current) => current.map((s) => (s.storeId === updated.storeId ? updated : s)));
      // Patch the assigned owner's store fields locally (rather than refetching the
      // whole owners list) so they no longer show as available.
      setAllOwners((current) =>
        current.map((o) =>
          o.ownerId === ownerId
            ? {
                ...o,
                storeId: updated.storeId,
                storeCode: updated.storeCode,
                storeName: updated.storeName,
                storeLocation: updated.storeLocation,
                storeActive: updated.storeActive,
              }
            : o,
        ),
      );
      setAssignTarget(null);
      nfToast.success(`Owner assigned to "${updated.storeName}".`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to assign owner';
      setAssignError(msg);
      nfToast.error(msg);
    } finally {
      setIsAssigning(false);
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
      return true;
    });
  }, [stores, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedStores = filteredStores.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = useMemo(() => stores.filter((store) => store.storeActive).length, [stores]);
  const totalEmployeeCount = useMemo(
    () => stores.reduce((sum, store) => sum + store.employeeCount, 0),
    [stores],
  );

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
          <SearchInput value={search} onChange={setSearch} placeholder="Search by store, ID, or owner" variant="filter" />
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
            onViewDetails={(store) => onNavigateToChecklist(store.storeId)}
            onToggleStatus={handleToggleStatus}
            onEdit={(store) => {
              setEditError(null);
              setEditTarget(store);
            }}
            onAssignOwner={(store) => {
              setAssignError(null);
              setAssignTarget(store);
            }}
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

      <EditStoreModal
        isOpen={editTarget !== null}
        initialValues={editTarget ? { name: editTarget.storeName, location: editTarget.storeLocation ?? '' } : undefined}
        errorMessage={editError}
        isSubmitting={isEditing}
        onClose={() => {
          setEditError(null);
          setEditTarget(null);
        }}
        onSubmit={handleEditSubmit}
      />

      <AssignStoreOwnerModal
        store={assignTarget}
        availableOwners={availableOwners}
        isSubmitting={isAssigning}
        errorMessage={assignError}
        onClose={() => {
          setAssignError(null);
          setAssignTarget(null);
        }}
        onSubmit={handleAssignOwner}
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
