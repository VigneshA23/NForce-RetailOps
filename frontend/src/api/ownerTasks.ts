import type { AdminTask, AdminTaskFormValues } from '../types/adminTask';
import { authHeaders } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

// Thrown when the backend refuses to delete a task because it has existing
// completion/history records. No such records can exist yet (there is no
// employee task-completion entity in this codebase), so this path is
// currently unreachable, but the API contract is ready for when one exists.
export class TaskHasHistoryError extends Error {}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

function toPayload(values: AdminTaskFormValues) {
  return {
    name: values.name.trim(),
    description: null,
    categoryId: values.categoryId,
    displayOrder: values.displayOrder.trim() !== '' ? Number(values.displayOrder) : null,
    appliesToAllStores: values.appliesToAllStores,
    storeIds: values.appliesToAllStores ? [] : values.storeIds,
    responseType: values.responseType,
    responseNote: values.responseType === 'TEXT' ? values.responseNote.trim() || null : null,
    numericUnit: values.responseType === 'NUMERIC' ? values.numericUnit.trim() || null : null,
    numericMin: values.responseType === 'NUMERIC' && values.numericMin.trim() !== '' ? Number(values.numericMin) : null,
    numericMax: values.responseType === 'NUMERIC' && values.numericMax.trim() !== '' ? Number(values.numericMax) : null,
    textMaxLength: values.responseType === 'TEXT' ? 25 : null,
    completionType: values.completionType,
    maxCompletions: null,
    scheduleType: values.scheduleType,
    selectedDays: values.scheduleType === 'SELECTED_DAYS' ? values.selectedDays : [],
    startDate: values.startDate,
    endDate: values.endDate.trim() || null,
    timeMode: 'ANYTIME',
    startTime: null,
    endTime: null,
    active: values.active,
  };
}

export async function getTasks(): Promise<AdminTask[]> {
  const response = await fetch(`${API_BASE_URL}/tasks`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load tasks'));
  }

  return response.json();
}

export async function createTask(values: AdminTaskFormValues): Promise<AdminTask> {
  const response = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(toPayload(values)),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create task'));
  }

  return response.json();
}

export async function updateTask(id: number, values: AdminTaskFormValues): Promise<AdminTask> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(toPayload(values)),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update task'));
  }

  return response.json();
}

export async function setTaskActive(id: number, active: boolean): Promise<AdminTask> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update task status'));
  }

  return response.json();
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, 'Failed to delete task');
    if (response.status === 409) {
      throw new TaskHasHistoryError(message);
    }
    throw new Error(message);
  }
}
