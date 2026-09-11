import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CircleCheck, Plus, Store as StoreIcon } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { addOwner, assignStore, deleteOwner, getOwners, setOwnerStatus, setStoreStatus, updateOwner } from '../api/owners';
import type { AddOwnerValues, AssignStoreValues, OwnerSummary, UpdateOwnerValues } from '../types/owner';
import type { GroupedOwner } from '../components/OwnerTable';
import type { AuthUser } from '../types/auth';
import type { SuperAdminNavTabKey } from '../types/navigation';
import { SUPER_ADMIN_NAV_ITEMS, SUPER_ADMIN_PAGE_TITLES } from '../types/navigation';
import OwnerTable from '../components/OwnerTable';
import OwnerDetailModal from '../components/OwnerDetailModal';
import OwnerFormModal from '../components/OwnerFormModal';
import OwnerEditModal from '../components/OwnerEditModal';
import AssignStoreModal from '../components/AssignStoreModal';
import TemporaryPasswordPopup from '../components/TemporaryPasswordPopup';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import SACommandPalette from '../components/SACommandPalette';
import SearchInput from '../components/SearchInput';
import StatCard from '../components/StatCard';
import AppShell from '../layouts/AppShell';
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import Settings from '../pages/Settings';
import Notifications from '../pages/Notifications';
import SuperAdminStores from '../pages/SuperAdminStores';
import SuperAdminEmployees from '../pages/SuperAdminEmployees';
import SuperAdminCategories from '../pages/SuperAdminCategories';
import SuperAdminHome from '../pages/SuperAdminHome';
import SuperAdminChecklist, { type ChecklistNav } from '../pages/SuperAdminChecklist';
import SuperAdminIssues from '../pages/SuperAdminIssues';
import SuperAdminInventory from '../pages/SuperAdminInventory';
import { getInitials } from '../utils/initials';
import { useUnreadCount } from '../hooks/useUnreadCount';
import './SuperAdminDashboard.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface SuperAdminDashboardProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  avatarUrl?: string | null;
  onAvatarChange?: (url: string | null) => void;
}

function SuperAdminDashboard({ user, onLogout, loggingOut, avatarUrl, onAvatarChange }: SuperAdminDashboardProps) {
  const [owners, setOwners] = useState<OwnerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add owner
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit owner
  const [editTarget, setEditTarget] = useState<GroupedOwner | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Status toggle (activate / deactivate via toggle switch)
  const [statusTarget, setStatusTarget] = useState<GroupedOwner | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Hard delete (via trash icon — permanently removes owner from DB)
  const [deleteTarget, setDeleteTarget] = useState<GroupedOwner | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Store status toggle
  const [storeStatusTarget, setStoreStatusTarget] = useState<OwnerSummary | null>(null);
  const [storeStatusError, setStoreStatusError] = useState<string | null>(null);

  // Owner detail view
  const [ownerDetailTarget, setOwnerDetailTarget] = useState<GroupedOwner | null>(null);

  // Assign store
  const [assignStoreTarget, setAssignStoreTarget] = useState<GroupedOwner | null>(null);
  const [assignStoreError, setAssignStoreError] = useState<string | null>(null);
  const [isAssigningStore, setIsAssigningStore] = useState(false);

  // Checklist tab navigation: storeId + monotone ts so re-navigation to the same store fires
  const [checklistNav, setChecklistNav] = useState<ChecklistNav | null>(null);

  function navigateToChecklist(storeId: number) {
    setChecklistNav({ storeId, ts: Date.now() });
    setShowProfile(false);
    setShowHelp(false);
    setShowSettings(false);
    setActiveTab('checklist');
  }

  const [tempPassword, setTempPassword] = useState<{ name: string; password: string; emailSent: boolean } | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [activeTab, setActiveTab] = useState<SuperAdminNavTabKey>('home');
  const [showProfile, setShowProfile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { count: unreadCount, setCount } = useUnreadCount();
  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  function handleNotificationsCountChange(value: number) {
    if (value === 0) setCount(0);
    else setCount((prev) => Math.max(0, prev + value));
  }

  function handleNotificationNavigate(path: string) {
    switch (path) {
      case '/checklist': setActiveTab('checklist'); setShowNotifications(false); break;
      default: setShowNotifications(true); break;
    }
  }

  function handleSearchNavigate(navTarget: string) {
    setShowProfile(false);
    setShowHelp(false);
    setShowSettings(false);
    setShowNotifications(false);
    if (navTarget.startsWith('checklist:')) {
      const storeId = parseInt(navTarget.split(':')[1], 10);
      if (!isNaN(storeId)) {
        navigateToChecklist(storeId);
      }
    } else if (navTarget === 'owners') {
      setActiveTab('owners');
    } else if (navTarget === 'employees') {
      setActiveTab('employees');
    }
  }

  function applyOwnerUpdates(updated: OwnerSummary[]) {
    const updatedByKey = new Map(updated.map((o) => [`${o.ownerId}-${o.storeId}`, o]));
    setOwners((current) =>
      current.map((o) => updatedByKey.get(`${o.ownerId}-${o.storeId}`) ?? o),
    );
  }

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
      const created = await addOwner(values);
      setIsFormOpen(false);
      loadOwners();
      nfToast.success(`"${values.ownerName}" owner added.`);
      setTempPassword({ name: values.ownerName, password: created.temporaryPassword, emailSent: created.emailSent });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditSubmit(values: UpdateOwnerValues) {
    if (!editTarget) return;
    setEditError(null);
    setIsEditSubmitting(true);
    try {
      const updated = await updateOwner(editTarget.ownerId, values);
      applyOwnerUpdates(updated);
      nfToast.success(`"${values.ownerName}" updated.`);
      setEditTarget(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update owner';
      setEditError(msg);
      nfToast.error(msg);
    } finally {
      setIsEditSubmitting(false);
    }
  }

  async function handleAssignStoreSubmit(values: AssignStoreValues) {
    if (!assignStoreTarget) return;
    setAssignStoreError(null);
    setIsAssigningStore(true);
    try {
      const ownerName = assignStoreTarget.ownerName;
      const assigned = await assignStore(assignStoreTarget.ownerId, values);
      // Reloaded rather than appended locally: assigning an existing store
      // moves it away from its previous (deactivated) owner, same as Add
      // Owner's existing-store path above -- only a full refresh keeps that
      // other owner's row correct too.
      loadOwners();
      setAssignStoreTarget(null);
      nfToast.success(`"${assigned.storeName}" store assigned to ${ownerName}.`);
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
      applyOwnerUpdates(updated);
      setStatusTarget(null);
      nfToast.success(`"${ownerName}" owner ${isActivating ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setStatusTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to update owner status';
      setStatusError(msg);
      nfToast.error(msg);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      const ownerName = deleteTarget.ownerName;
      await deleteOwner(deleteTarget.ownerId);
      setOwners((current) => current.filter((o) => o.ownerId !== deleteTarget.ownerId));
      setDeleteTarget(null);
      nfToast.success(`"${ownerName}" permanently deleted.`);
    } catch (error) {
      setDeleteTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to delete owner';
      setDeleteError(msg);
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
      applyOwnerUpdates(updated);
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
  const filteredOwners = owners.filter((owner) => {
    if (
      query &&
      !owner.ownerName.toLowerCase().includes(query) &&
      !owner.ownerEmail.toLowerCase().includes(query) &&
      !(owner.storeName?.toLowerCase().includes(query) ?? false)
    ) {
      return false;
    }
    if (statusFilter === 'ACTIVE' && !owner.ownerActive) return false;
    if (statusFilter === 'INACTIVE' && owner.ownerActive) return false;
    return true;
  });

  const uniqueOwnerCount = useMemo(() => new Set(owners.map((o) => o.ownerId)).size, [owners]);
  const activeOwnerCount = useMemo(
    () => new Set(owners.filter((o) => o.ownerActive).map((o) => o.ownerId)).size,
    [owners],
  );
  const totalStoreCount = useMemo(() => owners.filter((o) => o.storeId != null).length, [owners]);

  return (
    <AppShell<SuperAdminNavTabKey>
      navItems={SUPER_ADMIN_NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={(key) => {
        setShowProfile(false);
        setShowHelp(false);
        setShowSettings(false);
        setShowNotifications(false);
        setActiveTab(key);
      }}
      title={
        showProfile ? 'My Profile'
        : showHelp ? 'Help & Guidance'
        : showSettings ? 'Settings'
        : showNotifications ? 'Notifications'
        : SUPER_ADMIN_PAGE_TITLES[activeTab]
      }
      contentKey={
        showProfile ? 'profile'
        : showHelp ? 'help'
        : showSettings ? 'settings'
        : showNotifications ? 'notifications'
        : activeTab
      }
      logoSrc="/nforce-logo.png"
      hideLogoOnDesktop
      centeredModals
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
      avatarUrl={avatarUrl}
      onProfileClick={() => { setShowHelp(false); setShowSettings(false); setShowNotifications(false); setShowProfile(true); }}
      onHelpClick={() => { setShowProfile(false); setShowSettings(false); setShowNotifications(false); setShowHelp(true); }}
      onSettingsClick={() => { setShowProfile(false); setShowHelp(false); setShowNotifications(false); setShowSettings(true); }}
      onNotificationsClick={() => { setShowProfile(false); setShowHelp(false); setShowSettings(false); setShowNotifications(true); }}
      onNotificationNavigate={handleNotificationNavigate}
      notificationUnreadCount={unreadCount}
      onNotificationsCountChange={handleNotificationsCountChange}
      mobileNav="bottom-tabs"
      showSearch={false}
      headerActions={<SACommandPalette onNavigate={handleSearchNavigate} />}
    >
      {showProfile ? (
        <Profile initials={userInitials} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
      ) : showHelp ? (
        <Help />
      ) : showSettings ? (
        <Settings />
      ) : showNotifications ? (
        <Notifications onUnreadChange={handleNotificationsCountChange} onNavigate={handleNotificationNavigate} />
      ) : activeTab === 'checklist' ? (
        <SuperAdminChecklist nav={checklistNav} />
      ) : activeTab === 'home' ? (
        <SuperAdminHome owners={owners} ownersLoading={isLoading} onStoreClick={navigateToChecklist} onIssuesClick={() => setActiveTab('issues')} />
      ) : activeTab === 'stores' ? (
        <SuperAdminStores onNavigateToChecklist={navigateToChecklist} />
      ) : activeTab === 'employees' ? (
        <SuperAdminEmployees />
      ) : activeTab === 'categories' ? (
        <SuperAdminCategories />
      ) : activeTab === 'issues' ? (
        <SuperAdminIssues />
      ) : activeTab === 'inventory' ? (
        <SuperAdminInventory />
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

          {deleteError && (
            <div className="owners-page__error">
              <AlertCircle size={18} className="owners-page__error-icon" aria-hidden="true" />
              <span className="owners-page__error-message">{deleteError}</span>
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
            <>
              <div className="owners-page__header">
                <p className="owners-page__summary">
                  {isLoading
                    ? 'Loading owners...'
                    : `${uniqueOwnerCount} owner${uniqueOwnerCount === 1 ? '' : 's'} · ${totalStoreCount} store${totalStoreCount === 1 ? '' : 's'}`}
                </p>
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

              <div className="filter-bar">
                <div className="filter filter--search">
                  <SearchInput
                    value={searchValue}
                    onChange={setSearchValue}
                    placeholder="Search by name, email, or store..."
                    variant="filter"
                  />
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

              <div className="card">
              <OwnerTable
                owners={filteredOwners}
                isLoading={isLoading}
                emptyMessage={owners.length === 0 ? 'No owners yet. Add one to get started.' : 'No owners match your search.'}
                onEdit={(owner) => {
                  setEditError(null);
                  setEditTarget(owner);
                }}
                onToggleStatus={(owner) => {
                  setStatusError(null);
                  setStatusTarget(owner);
                }}
                onDelete={(owner) => {
                  setDeleteError(null);
                  setDeleteTarget(owner);
                }}
                onAddStore={(owner) => {
                  setAssignStoreError(null);
                  setAssignStoreTarget(owner);
                }}
                onView={(owner) => setOwnerDetailTarget(owner)}
              />
              </div>
            </>
          )}
        </div>
      )}

      {/* Add owner */}
      <OwnerFormModal
        isOpen={isFormOpen}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Edit owner */}
      <OwnerEditModal
        isOpen={editTarget !== null}
        initialValues={editTarget ? { ownerName: editTarget.ownerName, ownerEmail: editTarget.ownerEmail } : undefined}
        errorMessage={editError}
        isSubmitting={isEditSubmitting}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />

      {/* Assign store */}
      <AssignStoreModal
        isOpen={assignStoreTarget !== null}
        ownerName={assignStoreTarget?.ownerName}
        errorMessage={assignStoreError}
        isSubmitting={isAssigningStore}
        onClose={() => setAssignStoreTarget(null)}
        onSubmit={handleAssignStoreSubmit}
      />

      {/* Owner detail view */}
      <OwnerDetailModal
        owner={ownerDetailTarget}
        onClose={() => setOwnerDetailTarget(null)}
      />

      {/* Toggle status confirm (activate or deactivate) */}
      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={statusTarget?.ownerActive ? 'Deactivate Owner' : 'Activate Owner'}
        message={
          statusTarget
            ? statusTarget.ownerActive
              ? `Deactivate ${statusTarget.ownerName}? They will no longer be able to sign in.`
              : `Reactivate ${statusTarget.ownerName}? They will be able to sign in again.`
            : ''
        }
        confirmLabel={statusTarget?.ownerActive ? 'Deactivate' : 'Activate'}
        danger={statusTarget?.ownerActive ?? true}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />

      {/* Hard delete via trash icon */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Owner"
        message={
          deleteTarget
            ? `Permanently delete ${deleteTarget.ownerName}? This removes their account from the database entirely and cannot be undone. Their assigned stores will become reassignable.`
            : ''
        }
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Store status toggle confirm */}
      <ConfirmDialog
        isOpen={storeStatusTarget !== null}
        title={storeStatusTarget?.storeActive ? 'Deactivate Store' : 'Activate Store'}
        message={
          storeStatusTarget
            ? storeStatusTarget.storeActive
              ? `Deactivate ${storeStatusTarget.storeName}? ${storeStatusTarget.ownerName} will no longer be able to manage this store, its employees, or its tasks.`
              : `Reactivate ${storeStatusTarget.storeName}? ${storeStatusTarget.ownerName} will be able to manage it again.`
            : ''
        }
        confirmLabel={storeStatusTarget?.storeActive ? 'Deactivate' : 'Activate'}
        danger={storeStatusTarget?.storeActive ?? true}
        onConfirm={handleConfirmStoreStatusChange}
        onCancel={() => setStoreStatusTarget(null)}
      />

      <TemporaryPasswordPopup
        isOpen={tempPassword !== null}
        name={tempPassword?.name}
        password={tempPassword?.password ?? null}
        emailSent={tempPassword?.emailSent}
        onClose={() => setTempPassword(null)}
      />
    </AppShell>
  );
}

export default SuperAdminDashboard;
