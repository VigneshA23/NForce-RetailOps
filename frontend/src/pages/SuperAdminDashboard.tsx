import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CircleCheck, Plus, Store as StoreIcon } from 'lucide-react';
import { addOwner, assignStore, getOwners, setOwnerStatus, setStoreStatus } from '../api/owners';
import type { AssignStoreValues, OwnerFormValues, OwnerSummary } from '../types/owner';
import type { AuthUser } from '../types/auth';
import type { SuperAdminNavTabKey } from '../types/navigation';
import { SUPER_ADMIN_NAV_ITEMS, SUPER_ADMIN_PAGE_TITLES } from '../types/navigation';
import OwnerList from '../components/OwnerList';
import OwnerFormModal from '../components/OwnerFormModal';
import AssignStoreModal from '../components/AssignStoreModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import SearchInput from '../components/SearchInput';
import StatCard from '../components/StatCard';
import AppShell from '../layouts/AppShell';
import './SuperAdminDashboard.css';

interface SuperAdminDashboardProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
}

function SuperAdminDashboard({ user, onLogout, loggingOut }: SuperAdminDashboardProps) {
  const [owners, setOwners] = useState<OwnerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusTarget, setStatusTarget] = useState<OwnerSummary | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [storeStatusTarget, setStoreStatusTarget] = useState<OwnerSummary | null>(null);
  const [storeStatusError, setStoreStatusError] = useState<string | null>(null);
  const [assignStoreTarget, setAssignStoreTarget] = useState<OwnerSummary | null>(null);
  const [assignStoreError, setAssignStoreError] = useState<string | null>(null);
  const [isAssigningStore, setIsAssigningStore] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeTab] = useState<SuperAdminNavTabKey>('owners');

  function loadOwners() {
    setIsLoading(true);
    setLoadError(null);
    getOwners()
      .then(setOwners)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadOwners();
  }, []);

  async function handleFormSubmit(values: OwnerFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const created = await addOwner(values);
      setOwners((current) => [...current, created]);
      setIsFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignStoreSubmit(values: AssignStoreValues) {
    if (!assignStoreTarget) return;
    setAssignStoreError(null);
    setIsAssigningStore(true);
    try {
      const created = await assignStore(assignStoreTarget.ownerId, values);
      setOwners((current) => [...current, created]);
      setAssignStoreTarget(null);
    } catch (error) {
      setAssignStoreError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsAssigningStore(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    setStatusError(null);
    try {
      const updated = await setOwnerStatus(statusTarget.ownerId, !statusTarget.ownerActive);
      const updatedByStoreId = new Map(updated.map((owner) => [owner.storeId, owner]));
      setOwners((current) => current.map((owner) => updatedByStoreId.get(owner.storeId) ?? owner));
      setStatusTarget(null);
    } catch (error) {
      setStatusTarget(null);
      setStatusError(error instanceof Error ? error.message : 'Failed to update owner status');
    }
  }

  async function handleConfirmStoreStatusChange() {
    if (!storeStatusTarget) return;
    setStoreStatusError(null);
    try {
      const updated = await setStoreStatus(
        storeStatusTarget.ownerId,
        storeStatusTarget.storeId,
        !storeStatusTarget.storeActive,
      );
      const updatedByStoreId = new Map(updated.map((owner) => [owner.storeId, owner]));
      setOwners((current) => current.map((owner) => updatedByStoreId.get(owner.storeId) ?? owner));
      setStoreStatusTarget(null);
    } catch (error) {
      setStoreStatusTarget(null);
      setStoreStatusError(error instanceof Error ? error.message : 'Failed to update store status');
    }
  }

  const query = searchValue.trim().toLowerCase();
  const filteredOwners = query
    ? owners.filter(
        (owner) =>
          owner.ownerName.toLowerCase().includes(query) ||
          owner.ownerEmail.toLowerCase().includes(query) ||
          owner.storeName.toLowerCase().includes(query),
      )
    : owners;

  const uniqueOwnerCount = useMemo(() => new Set(owners.map((owner) => owner.ownerId)).size, [owners]);
  const activeOwnerCount = useMemo(
    () => new Set(owners.filter((owner) => owner.ownerActive).map((owner) => owner.ownerId)).size,
    [owners],
  );

  return (
    <AppShell<SuperAdminNavTabKey>
      navItems={SUPER_ADMIN_NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={() => {}}
      title={SUPER_ADMIN_PAGE_TITLES[activeTab]}
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
    >
      <div className="owners-page">
        <div className="stat-card-row">
          <StatCard icon={Building2} label="Total Owners" value={uniqueOwnerCount} tone="primary" />
          <StatCard icon={CircleCheck} label="Active Owners" value={activeOwnerCount} tone="success" />
          <StatCard icon={StoreIcon} label="Total Stores" value={owners.length} tone="info" />
        </div>

        {statusError && (
          <div className="owners-page__error">
            <AlertCircle size={18} className="owners-page__error-icon" aria-hidden="true" />
            <span className="owners-page__error-message">{statusError}</span>
          </div>
        )}

        {storeStatusError && (
          <div className="owners-page__error">
            <AlertCircle size={18} className="owners-page__error-icon" aria-hidden="true" />
            <span className="owners-page__error-message">{storeStatusError}</span>
          </div>
        )}

        {loadError ? (
          <div className="owners-page__error">
            <AlertCircle size={18} className="owners-page__error-icon" aria-hidden="true" />
            <span className="owners-page__error-message">{loadError}</span>
            <button type="button" className="btn btn--secondary" onClick={loadOwners}>
              Retry
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">All Owners</h2>
              <div className="card__toolbar">
                <SearchInput
                  variant="card"
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search by owner, email, or store..."
                />
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
                  <span className="owners-page__add-label">
                    <Plus size={16} />
                    Add Owner
                  </span>
                </SpecularButton>
              </div>
            </div>
            <OwnerList
              owners={filteredOwners}
              isLoading={isLoading}
              onToggleStatus={setStatusTarget}
              onAddStore={(owner) => {
                setAssignStoreError(null);
                setAssignStoreTarget(owner);
              }}
              onToggleStoreStatus={(store) => {
                setStoreStatusError(null);
                setStoreStatusTarget(store);
              }}
            />
          </div>
        )}
      </div>

      <OwnerFormModal
        isOpen={isFormOpen}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <AssignStoreModal
        isOpen={assignStoreTarget !== null}
        ownerName={assignStoreTarget?.ownerName}
        errorMessage={assignStoreError}
        isSubmitting={isAssigningStore}
        onClose={() => setAssignStoreTarget(null)}
        onSubmit={handleAssignStoreSubmit}
      />

      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={statusTarget?.ownerActive ? 'Deactivate Owner' : 'Activate Owner'}
        message={
          statusTarget
            ? statusTarget.ownerActive
              ? `Are you sure you want to deactivate ${statusTarget.ownerName}? They will no longer be able to sign in.`
              : `Reactivate ${statusTarget.ownerName}? They will be able to sign in again.`
            : ''
        }
        confirmLabel={statusTarget?.ownerActive ? 'Deactivate' : 'Activate'}
        danger={statusTarget?.ownerActive ?? true}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        isOpen={storeStatusTarget !== null}
        title={storeStatusTarget?.storeActive ? 'Deactivate Store' : 'Activate Store'}
        message={
          storeStatusTarget
            ? storeStatusTarget.storeActive
              ? `Are you sure you want to deactivate ${storeStatusTarget.storeName}? ${storeStatusTarget.ownerName} will no longer be able to manage this store, its employees, or its tasks.`
              : `Reactivate ${storeStatusTarget.storeName}? ${storeStatusTarget.ownerName} will be able to manage it again.`
            : ''
        }
        confirmLabel={storeStatusTarget?.storeActive ? 'Deactivate' : 'Activate'}
        danger={storeStatusTarget?.storeActive ?? true}
        onConfirm={handleConfirmStoreStatusChange}
        onCancel={() => setStoreStatusTarget(null)}
      />
    </AppShell>
  );
}

export default SuperAdminDashboard;
