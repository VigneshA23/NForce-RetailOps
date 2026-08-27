import type { Category, CategoryFormValues } from '../types/category';
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

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load categories'));
  }

  return response.json();
}

export async function createCategory(values: CategoryFormValues): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/categories`, {
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
  const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update category'));
  }

  return response.json();
}
