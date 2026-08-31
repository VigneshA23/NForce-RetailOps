import { apiRequest } from './client';
import type { StoreSummary } from '../types/store';

interface AssignedStoreResponse {
  id: number;
  name: string;
  location: string | null;
  active: boolean;
}

/**
 * The stores the signed-in user may work in: an employee's assigned stores, or
 * an owner's own stores. Scoped server-side from the bearer token, so this is
 * the authoritative list -- never widen it on the client.
 */
export async function getAuthorizedStores(): Promise<StoreSummary[]> {
  const stores = await apiRequest<AssignedStoreResponse[]>('/me/stores');
  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    location: store.location,
    status: store.active ? 'Open' : 'Closed',
  }));
}
