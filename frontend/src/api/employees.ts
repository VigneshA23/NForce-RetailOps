import type { Employee, EmployeeDirectoryEntry, EmployeeUpdateValues } from '../types/employee';
import { authHeaders } from '../utils/authStorage';
import { fetchWithTimeout } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

// A field-validation failure (e.g. @Valid on EmployeeUpdateRequest) comes back
// as { field: message } with no top-level "message" key -- GlobalExceptionHandler's
// generic shape for domain errors (EmployeeNotFoundException, etc.) is the only
// one with `message`. Without this fallback, any blank/invalid field on save
// surfaced as the generic `fallback` text instead of the actual reason (e.g.
// "Employment type is required"), leaving the user with no way to tell what to
// fix.
//
// The field-map extraction is scoped to 400 responses only -- that's the one
// status GlobalExceptionHandler's validation handler ever returns this shape
// with. An unhandled 500 falls through to Spring Boot's own default error body
// ({timestamp, status, error, path}, no "message"), which is *also* a plain
// object of string values; without this guard those framework-internal fields
// would get displayed to the user as if they were the failure reason.
async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string') return body.message;
      if (response.status === 400) {
        const fieldMessages = Object.values(body).filter((value): value is string => typeof value === 'string');
        if (fieldMessages.length > 0) return fieldMessages.join(' ');
      }
    }
    return fallback;
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
