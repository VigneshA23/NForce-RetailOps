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
  return toSummaries(await apiRequest<AssignedStoreResponse[]>('/me/stores'));
}

/**
 * The stores the signed-in Owner/Admin is actively linked to: none (empty
 * state), one (selected automatically) or several (store picker). Exempt from
 * the backend's selected-store check, so it still answers after the admin's
 * selected store was revoked.
 */
export async function getOwnerAssignedStores(): Promise<StoreSummary[]> {
  return toSummaries(await apiRequest<AssignedStoreResponse[]>('/owner-stores'));
}

function toSummaries(stores: AssignedStoreResponse[]): StoreSummary[] {
  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    location: store.location,
    status: store.active ? 'Open' : 'Closed',
  }));
}
