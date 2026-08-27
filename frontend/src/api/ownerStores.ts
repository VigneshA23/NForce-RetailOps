import type { OwnerStore, OwnerStoreFormValues } from '../types/ownerStore';
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

export async function getStores(): Promise<OwnerStore[]> {
  const response = await fetch(`${API_BASE_URL}/stores`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load stores'));
  }

  return response.json();
}

export async function createStore(values: OwnerStoreFormValues): Promise<OwnerStore> {
  const response = await fetch(`${API_BASE_URL}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create store'));
  }

  return response.json();
}

export async function renameStore(id: number, values: OwnerStoreFormValues): Promise<OwnerStore> {
  const response = await fetch(`${API_BASE_URL}/stores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update store'));
  }

  return response.json();
}

export async function deleteStore(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/stores/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to delete store'));
  }
}
