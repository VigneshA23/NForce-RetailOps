import type { Category, CategoryFormValues } from '../types/category';
import { authHeaders } from '../utils/authStorage';
import { fetchWithTimeout } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

// Narrows the category picker to only categories applicable to a given store
// scope (single store, the intersection of several, or every store for "All
// Stores") -- shared by the Owner Admin and Super Admin task forms, since
// GET /categories/applicable is authorized for both roles and branches
// server-side on the caller (an owner only ever sees their own categories).
export async function getApplicableCategories(scope: { appliesToAllStores: boolean; storeIds: number[] }): Promise<Category[]> {
  const params = new URLSearchParams();
  params.set('appliesToAllStores', String(scope.appliesToAllStores));
  if (!scope.appliesToAllStores) {
    scope.storeIds.forEach((id) => params.append('storeIds', String(id)));
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/categories/applicable?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load categories for the selected stores'));
  }

  return response.json();
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/categories`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load categories'));
  }

  return response.json();
}

export async function createCategory(values: CategoryFormValues): Promise<Category> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create category'));
  }

  return response.json();
}

export async function updateCategory(id: number, values: CategoryFormValues): Promise<Category> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update category'));
  }

  return response.json();
}

export async function updateCategoryStatus(id: number, active: boolean): Promise<Category> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/categories/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update category status'));
  }

  return response.json();
}

export async function reorderCategories(orderedIds: number[]): Promise<Category[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/categories/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ orderedIds }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to save the new category order'));
  }

  return response.json();
}

export async function deleteCategory(id: number): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to delete category'));
  }
}
