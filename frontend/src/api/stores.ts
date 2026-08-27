import type { StoreSummary } from '../types/store';

const MOCK_STORES: StoreSummary[] = [
  { id: 'store-1', name: 'Store 1', status: 'Open' },
  { id: 'store-2', name: 'Store 2', status: 'Open' },
  { id: 'store-3', name: 'Store 3', status: 'Closed' },
];

const SIMULATED_LATENCY_MS = 200;

export async function getAuthorizedStores(): Promise<StoreSummary[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_STORES.map((store) => ({ ...store }))), SIMULATED_LATENCY_MS);
  });
}

// TODO: once the backend exposes authorized stores per employee (see user_stores model),
// replace MOCK_STORES with a fetch against `${VITE_API_BASE_URL}/api/me/stores` (or embed
// authorizedStores in the login response) and drop this mock entirely.
