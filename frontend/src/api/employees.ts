import type { Employee, EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
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

export async function getEmployees(): Promise<Employee[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to load employees'));
  return response.json();
}

export async function getAssignableStores(): Promise<StoreOption[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees/stores`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to load stores'));
  return response.json();
}

export async function createEmployee(values: EmployeeCreateValues): Promise<Employee> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to create employee'));
  return response.json();
}

export async function updateEmployee(id: number, values: EmployeeUpdateValues): Promise<Employee> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to update employee'));
  return response.json();
}

export async function deleteEmployee(id: number): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to delete employee'));
}

export async function setEmployeeStatus(id: number, active: boolean): Promise<Employee> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ active }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to update employee status'));
  return response.json();
}
