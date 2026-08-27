import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { addOwner, getOwners, setOwnerStatus } from '../api/owners';
import type { OwnerFormValues, OwnerSummary } from '../types/owner';
import type { AuthUser } from '../types/auth';
import OwnerTable from '../components/OwnerTable';
import OwnerFormModal from '../components/OwnerFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import Header from '../components/Header';
import { useTheme } from '../hooks/useTheme';
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
  const [searchValue, setSearchValue] = useState('');
  const { isDarkTheme, toggleTheme } = useTheme();

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

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    setStatusError(null);
    try {
      const updated = await setOwnerStatus(statusTarget.ownerId, !statusTarget.active);
      const updatedByStoreId = new Map(updated.map((owner) => [owner.storeId, owner]));
      setOwners((current) => current.map((owner) => updatedByStoreId.get(owner.storeId) ?? owner));
      setStatusTarget(null);
    } catch (error) {
      setStatusTarget(null);
      setStatusError(error instanceof Error ? error.message : 'Failed to update owner status');
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

  return (
    <div className="super-admin-shell">
      <div className="super-admin-shell__header">
        <Header
          title="Owners"
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isDarkTheme={isDarkTheme}
          onToggleTheme={toggleTheme}
          userName={user.fullName}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      </div>
      <main className="super-admin-shell__main">
        <div className="owners-page">
          <div className="owners-page__toolbar">
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

          {statusError && <div className="owners-page__error">{statusError}</div>}

          {loadError ? (
            <div className="owners-page__error">
              {loadError}
              <button type="button" className="btn btn--secondary" onClick={loadOwners}>
                Retry
              </button>
            </div>
          ) : (
            <OwnerTable owners={filteredOwners} isLoading={isLoading} onToggleStatus={setStatusTarget} />
          )}
        </div>
      </main>

      <OwnerFormModal
        isOpen={isFormOpen}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={statusTarget?.active ? 'Deactivate Owner' : 'Activate Owner'}
        message={
          statusTarget
            ? statusTarget.active
              ? `Are you sure you want to deactivate ${statusTarget.ownerName}? They will no longer be able to sign in.`
              : `Reactivate ${statusTarget.ownerName}? They will be able to sign in again.`
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

export default SuperAdminDashboard;
