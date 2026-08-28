import { useEffect, useMemo, useState } from 'react';
import { Plus, Store as StoreIcon, CircleCheck, CircleSlash } from 'lucide-react';
import { getStores, createStore, renameStore, deleteStore } from '../api/ownerStores';
import type { OwnerStore, OwnerStoreFormValues } from '../types/ownerStore';
import StoreTable from '../components/StoreTable';
import StoreFormModal from '../components/StoreFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './Stores.css';

type FormModalState = { mode: 'create' } | { mode: 'edit'; store: OwnerStore } | null;

function Stores() {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OwnerStore | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function loadStores() {
    setIsLoading(true);
    setLoadError(null);
    getStores()
      .then(setStores)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadStores();
  }, []);

  async function handleFormSubmit(values: OwnerStoreFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formModalState?.mode === 'edit') {
        const updated = await renameStore(formModalState.store.id, values);
        setStores((current) => current.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await createStore(values);
        setStores((current) => [...current, created]);
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
      await deleteStore(deleteTarget.id);
      setStores((current) => current.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteTarget(null);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete store');
    }
  }

  const activeCount = useMemo(() => stores.filter((store) => store.active).length, [stores]);

  return (
    <div className="stores-page">
      <div className="stat-card-row">
        <StatCard icon={StoreIcon} label="Total Stores" value={stores.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active Stores" value={activeCount} tone="success" />
        <StatCard icon={CircleSlash} label="Inactive Stores" value={stores.length - activeCount} tone="warning" />
      </div>

      {deleteError && <div className="stores-page__error">{deleteError}</div>}

      {loadError ? (
        <div className="stores-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={loadStores}>
            Retry
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">All Stores</h2>
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
                <span className="stores-page__add-label">
                  <Plus size={16} />
                  Add Store
                </span>
              </SpecularButton>
            </div>
          </div>
          <StoreTable
            stores={stores}
            isLoading={isLoading}
            onEdit={(store) => {
              setFormError(null);
              setFormModalState({ mode: 'edit', store });
            }}
            onDelete={(store) => {
              setDeleteError(null);
              setDeleteTarget(store);
            }}
          />
        </div>
      )}

      <StoreFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialValues={formModalState?.mode === 'edit' ? { name: formModalState.store.name } : undefined}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Store"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.name}? This cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default Stores;
