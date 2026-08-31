import { useEffect, useMemo, useState } from 'react';
import { Store as StoreIcon, CircleCheck, CircleSlash } from 'lucide-react';
import { getStores, renameStore } from '../api/ownerStores';
import type { OwnerStore } from '../types/ownerStore';
import StoreTable from '../components/StoreTable';
import StoreFormModal from '../components/StoreFormModal';
import StatCard from '../components/StatCard';
import './Stores.css';

function Stores() {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<OwnerStore | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleFormSubmit(values: { name: string }) {
    if (!editTarget) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const updated = await renameStore(editTarget.id, values);
      setStores((current) => current.map((s) => (s.id === updated.id ? updated : s)));
      setEditTarget(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
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
          </div>
          <StoreTable
            stores={stores}
            isLoading={isLoading}
            onEdit={(store) => {
              setFormError(null);
              setEditTarget(store);
            }}
          />
        </div>
      )}

      <StoreFormModal
        isOpen={editTarget !== null}
        initialValues={editTarget ? { name: editTarget.name } : undefined}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setEditTarget(null)}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}

export default Stores;
