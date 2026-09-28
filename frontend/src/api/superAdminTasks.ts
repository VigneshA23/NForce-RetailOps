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

// Editing an existing task's content. The store scope can be widened to
// stores under other owners here -- the backend fans that out into new task
// rows for them alongside the edited task (see TaskService.
// updateTaskAsSuperAdmin), so, like createTasks, this can return more than
// one AdminTask.
export async function updateTask(id: number, values: AdminTaskFormValues): Promise<AdminTask[]> {
  return apiRequest<AdminTask[]>(`/tasks/${id}/super-admin`, { method: 'PUT', body: toPayload(values) });
}

// The inverse of toPayload -- rebuilds the form-values shape updateTask()
// needs from an already-fetched AdminTask, so callers that only want to
// change one field (e.g. moving a task into a different category from the
// Categories page) don't have to reconstruct the whole form by hand.
export function taskToFormValues(task: AdminTask): AdminTaskFormValues {
  return {
    name: task.name,
    description: task.description ?? '',
    categoryId: task.categoryId,
    displayOrder: task.displayOrder != null ? String(task.displayOrder) : '',
    appliesToAllStores: task.appliesToAllStores,
    storeIds: task.stores.map((store) => store.id),
    responseType: task.responseType,
    responseNote: task.responseNote ?? '',
    numericUnit: task.numericUnit ?? '',
    numericMin: task.numericMin != null ? String(task.numericMin) : '',
    numericMax: task.numericMax != null ? String(task.numericMax) : '',
    completionType: task.completionType,
    scheduleType: task.scheduleType,
    selectedDays: task.selectedDays,
    oneTimeDate: task.scheduleType === 'ONE_TIME' ? task.startDate : '',
    startDate: task.startDate,
    endDate: task.endDate ?? '',
    active: task.active,
  };
}

// Categories page "+ Tasks" flow: moves an already-existing task into
// `categoryId` without creating a new task record. Store scope is left as
// the task's own existing scope, so this never widens to another owner and
// updateTask's result always has exactly the one (updated) task in it.
export async function assignTaskToCategory(task: AdminTask, categoryId: number): Promise<AdminTask> {
  const [updated] = await updateTask(task.id, { ...taskToFormValues(task), categoryId });
  return updated;
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
