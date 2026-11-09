import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllStores } from '../api/superAdminStores';
import type { SuperAdminStore } from '../types/superAdminStore';
import FormField from '../components/FormField';
import SearchableSelect from '../components/SearchableSelect';
import { usePersistedState, nullableNumber } from '../hooks/usePersistedState';
import DailyCash from './DailyCash';

// Super Admin's Daily Cash Entry: the Owner/Admin form for any active store,
// picked with the same searchable store selector the Super Admin Daily
// Checklist uses. The chosen store survives a refresh.
function SuperAdminCash() {
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedStoreId, setSelectedStoreId] = usePersistedState<number | null>('sa-cash-store', null, nullableNumber);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    setStoresLoading(true);
    setStoresError(null);
    getAllStores()
      .then((data) => {
        if (active) setStores(data.filter((store) => store.storeActive));
      })
      .catch((cause: unknown) => {
        if (active) setStoresError(cause instanceof Error ? cause.message : 'Could not load stores');
      })
      .finally(() => {
        if (active) setStoresLoading(false);
      });
    return () => { active = false; };
  }, [reloadToken]);

  // Drop a remembered store that has since been deactivated or deleted.
  const storeId = !storesLoading && stores.some((store) => store.storeId === selectedStoreId) ? selectedStoreId : null;

  const options = useMemo(
    () => stores.map((store) => ({ id: store.storeId, label: store.storeName, sublabel: `#${store.storeCode}` })),
    [stores],
  );

  return (
    <DailyCash
      scope="super-admin"
      storeId={storeId}
      storesLoading={storesLoading}
      noStoreMessage="Select a store to enter or review its daily cash."
      storeSelector={
        <FormField label="Store" htmlFor="daily-cash-store">
          <SearchableSelect
            id="daily-cash-store"
            options={options}
            selectedIds={storeId === null ? [] : [storeId]}
            onChange={(ids) => setSelectedStoreId(ids[0] ?? null)}
            placeholder="Select a store…"
            isLoading={storesLoading}
            error={storesError}
            onRetry={reload}
            emptyMessage="No stores found"
          />
        </FormField>
      }
    />
  );
}

export default SuperAdminCash;
