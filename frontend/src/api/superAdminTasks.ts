import type { Category } from '../types/category';
import type { AdminTask, AdminTaskFormValues } from '../types/adminTask';
import { TaskHasHistoryError } from './ownerTasks';
import { apiRequest, ApiError } from './client';

export { TaskHasHistoryError };

function toPayload(values: AdminTaskFormValues) {
  const isOneTime = values.scheduleType === 'ONE_TIME';
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
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
    scheduleType: isOneTime ? 'EVERY_DAY' : values.scheduleType,
    selectedDays: !isOneTime && values.scheduleType === 'SELECTED_DAYS' ? values.selectedDays : [],
    startDate: isOneTime ? values.oneTimeDate : values.startDate,
    endDate: isOneTime ? values.oneTimeDate : (values.endDate.trim() || null),
    timeMode: 'ANYTIME',
    startTime: null,
    endTime: null,
    active: values.active,
  };
}

// Platform-wide task list -- shares GET /tasks with the Owner Admin endpoint,
// which branches server-side on the caller's role.
export async function getAllTasks(): Promise<AdminTask[]> {
  return apiRequest<AdminTask[]>('/tasks');
}

// Step 1 of the create-task wizard: narrows the category picker to only
// categories applicable to the chosen store scope (single store, the
// intersection of several, or every store for "All Stores").
export async function getApplicableCategories(scope: { appliesToAllStores: boolean; storeIds: number[] }): Promise<Category[]> {
  const params = new URLSearchParams();
  params.set('appliesToAllStores', String(scope.appliesToAllStores));
  if (!scope.appliesToAllStores) {
    scope.storeIds.forEach((id) => params.append('storeIds', String(id)));
  }
  return apiRequest<Category[]>(`/categories/applicable?${params.toString()}`);
}

// May create more than one Task row under the hood -- one per owner among the
// selected stores (see backend TaskService.createTasksAsSuperAdmin) -- so this
// returns the full set created.
export async function createTasks(values: AdminTaskFormValues): Promise<AdminTask[]> {
  return apiRequest<AdminTask[]>('/tasks/super-admin', { method: 'POST', body: toPayload(values) });
}

// Editing an existing task's content -- its store/category scope stays
// whatever it already was (validated against that task's own owner
// server-side), only the other fields are actually meant to change here.
export async function updateTask(id: number, values: AdminTaskFormValues): Promise<AdminTask> {
  return apiRequest<AdminTask>(`/tasks/${id}/super-admin`, { method: 'PUT', body: toPayload(values) });
}

export async function setTaskActive(id: number, active: boolean): Promise<AdminTask> {
  return apiRequest<AdminTask>(`/tasks/${id}/status/super-admin`, { method: 'PATCH', body: { active } });
}

export async function deleteTask(id: number): Promise<void> {
  try {
    await apiRequest<void>(`/tasks/${id}/super-admin`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new TaskHasHistoryError(error.message);
    }
    throw error;
  }
}
