import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CircleCheck, Plus, Store as StoreIcon } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { addOwner, assignStore, getOwners, setOwnerStatus, setStoreStatus } from '../api/owners';
import type { AddOwnerValues, AssignStoreValues, OwnerSummary } from '../types/owner';
import type { AuthUser } from '../types/auth';
import type { SuperAdminNavTabKey } from '../types/navigation';
import { SUPER_ADMIN_NAV_ITEMS, SUPER_ADMIN_PAGE_TITLES } from '../types/navigation';
import OwnerList from '../components/OwnerList';
import OwnerFormModal from '../components/OwnerFormModal';
import AssignStoreModal from '../components/AssignStoreModal';
import ChecklistHistoryDetailModal from '../components/ChecklistHistoryDetailModal';
import type { ChecklistHistoryDetailTarget } from '../components/ChecklistHistoryDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import SearchInput from '../components/SearchInput';
import StatCard from '../components/StatCard';
import AppShell from '../layouts/AppShell';
import Profile from './Profile';
import { getInitials } from '../utils/initials';
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
  const [storeChecklistTarget, setStoreChecklistTarget] = useState<ChecklistHistoryDetailTarget | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [activeTab] = useState<SuperAdminNavTabKey>('owners');
  const [overlay, setOverlay] = useState<'profile' | null>(null);

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName]);

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

  async function handleFormSubmit(values: AddOwnerValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await addOwner(values);
      setIsFormOpen(false);
      // Reloaded rather than appended locally: assigning an existing store
      // moves it away from its previous (deactivated) owner, so a full
      // refresh is the only way to keep that owner's row correct too.
      loadOwners();
      nfToast.success(`"${values.ownerName}" owner added.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignStoreSubmit(values: AssignStoreValues) {
    if (!assignStoreTarget) return;
    setAssignStoreError(null);
    setIsAssigningStore(true);
    try {
      const ownerName = assignStoreTarget.ownerName;
      const created = await assignStore(assignStoreTarget.ownerId, values);
      setOwners((current) => [...current, created]);
      setAssignStoreTarget(null);
      nfToast.success(`"${values.storeName}" store assigned to ${ownerName}.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setAssignStoreError(msg);
      nfToast.error(msg);
    } finally {
      setIsAssigningStore(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    setStatusError(null);
    try {
      const ownerName = statusTarget.ownerName;
      const isActivating = !statusTarget.ownerActive;
      const updated = await setOwnerStatus(statusTarget.ownerId, isActivating);
      // Keyed by owner+store rather than bare storeId: several store-less
      // owners would all carry storeId `null` and collide on that alone.
      const updatedByKey = new Map(updated.map((owner) => [`${owner.ownerId}-${owner.storeId}`, owner]));
      setOwners((current) =>
        current.map((owner) => updatedByKey.get(`${owner.ownerId}-${owner.storeId}`) ?? owner),
      );
      setStatusTarget(null);
      nfToast.success(`"${ownerName}" owner ${isActivating ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setStatusTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to update owner status';
      setStatusError(msg);
      nfToast.error(msg);
    }
  }

  async function handleConfirmStoreStatusChange() {
    if (!storeStatusTarget || storeStatusTarget.storeId == null) return;
    setStoreStatusError(null);
    try {
      const storeName = storeStatusTarget.storeName ?? 'Store';
      const isActivating = !storeStatusTarget.storeActive;
      const updated = await setStoreStatus(
        storeStatusTarget.ownerId,
        storeStatusTarget.storeId,
        isActivating,
      );
      const updatedByKey = new Map(updated.map((owner) => [`${owner.ownerId}-${owner.storeId}`, owner]));
      setOwners((current) =>
        current.map((owner) => updatedByKey.get(`${owner.ownerId}-${owner.storeId}`) ?? owner),
      );
      setStoreStatusTarget(null);
      nfToast.success(`"${storeName}" store ${isActivating ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setStoreStatusTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to update store status';
      setStoreStatusError(msg);
      nfToast.error(msg);
    }
  }

  const query = searchValue.trim().toLowerCase();
  const filteredOwners = query
    ? owners.filter(
        (owner) =>
          owner.ownerName.toLowerCase().includes(query) ||
          owner.ownerEmail.toLowerCase().includes(query) ||
          (owner.storeName?.toLowerCase().includes(query) ?? false),
      )
    : owners;

  const uniqueOwnerCount = useMemo(() => new Set(owners.map((owner) => owner.ownerId)).size, [owners]);
  const activeOwnerCount = useMemo(
    () => new Set(owners.filter((owner) => owner.ownerActive).map((owner) => owner.ownerId)).size,
    [owners],
  );
  const totalStoreCount = useMemo(() => owners.filter((owner) => owner.storeId != null).length, [owners]);

  const title = overlay === 'profile' ? 'My Profile' : SUPER_ADMIN_PAGE_TITLES[activeTab];

  return (
    <AppShell<SuperAdminNavTabKey>
      navItems={SUPER_ADMIN_NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={() => setOverlay(null)}
      title={title}
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
      onProfileClick={() => setOverlay('profile')}
    >
      {overlay === 'profile' ? (
        <Profile initials={userInitials} />
      ) : (
        <div className="owners-page">
          <div className="stat-card-row">
            <StatCard icon={Building2} label="Total Owners" value={uniqueOwnerCount} tone="primary" />
            <StatCard icon={CircleCheck} label="Active Owners" value={activeOwnerCount} tone="success" />
            <StatCard icon={StoreIcon} label="Total Stores" value={totalStoreCount} tone="info" />
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
                onViewStoreChecklist={(store) => {
                  if (store.storeId == null || store.storeName == null) return;
                  setStoreChecklistTarget({
                    storeId: store.storeId,
                    storeName: store.storeName,
                    date: new Date().toISOString().slice(0, 10),
                  });
                }}
              />
            </div>
          )}
        </div>
      )}

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

      <ChecklistHistoryDetailModal
        target={storeChecklistTarget}
        onClose={() => setStoreChecklistTarget(null)}
      />
    </AppShell>
  );
}

export default SuperAdminDashboard;
