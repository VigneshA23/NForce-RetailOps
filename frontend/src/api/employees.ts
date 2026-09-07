import type { Employee, EmployeeDirectoryEntry, EmployeeUpdateValues } from '../types/employee';
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

// Cross-owner directory for the "Assign Employee" flow -- every active
// employee platform-wide (created by the Super Admin), so the caller can find
// one and add their own store to it.
export async function getEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees/directory`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to load employees'));
  return response.json();
}

export async function assignEmployeeToMyStore(id: number): Promise<Employee> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees/${id}/assignment`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to assign employee to your store'));
  return response.json();
}

export async function unassignEmployeeFromMyStore(id: number): Promise<Employee> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/employees/${id}/assignment`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response, 'Failed to remove employee from your store'));
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
