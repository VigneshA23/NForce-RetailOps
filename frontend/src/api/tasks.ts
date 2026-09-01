import type { ChecklistCategory, CompletionType, TaskResponseType } from '../types/task';
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

export async function getDailyChecklist(storeId: number): Promise<ChecklistCategory[]> {
  const response = await fetch(`${API_BASE_URL}/stores/${storeId}/checklist`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load checklist'));
  }

  const categories: Array<{
    id: number;
    name: string;
    tasks: Array<{
      id: number;
      name: string;
      description: string | null;
      responseType: TaskResponseType;
      responseNote: string | null;
      numericUnit: string | null;
      numericMin: number | null;
      numericMax: number | null;
      textMaxLength: number | null;
      completionType: CompletionType;
      maxCompletions: number | null;
    }>;
  }> = await response.json();

  return categories.map((category) => ({
    id: String(category.id),
    name: category.name,
    tasks: category.tasks.map((task) => ({ ...task, id: String(task.id) })),
  }));
}

// TODO: replace with a real "raise issue with owner" endpoint once one exists on the backend.
export async function raiseIssue(_storeId: number, _note: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
}
