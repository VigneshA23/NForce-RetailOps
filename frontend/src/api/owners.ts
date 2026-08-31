import type { AssignStoreValues, OwnerFormValues, OwnerSummary } from '../types/owner';
import { authHeaders } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getOwners(): Promise<OwnerSummary[]> {
  const response = await fetch(`${API_BASE_URL}/owners`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to load owners'));
  return response.json();
}

export async function addOwner(values: OwnerFormValues): Promise<OwnerSummary> {
  const response = await fetch(`${API_BASE_URL}/addowners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to add owner'));
  return response.json();
}

export async function assignStore(ownerId: number, values: AssignStoreValues): Promise<OwnerSummary> {
  const response = await fetch(`${API_BASE_URL}/owners/${ownerId}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to add store'));
  return response.json();
}

export async function setOwnerStatus(ownerId: number, active: boolean): Promise<OwnerSummary[]> {
  const response = await fetch(`${API_BASE_URL}/owners/${ownerId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ active }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to update owner status'));
  return response.json();
}
