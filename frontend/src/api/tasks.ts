import type { ChecklistCategory } from '../types/task';
import { authHeaders } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

interface EmployeeTaskDto {
  id: number;
  name: string;
  description: string | null;
}

interface EmployeeChecklistCategoryDto {
  categoryId: number;
  categoryName: string;
  tasks: EmployeeTaskDto[];
}

export async function getDailyChecklist(storeId: string): Promise<ChecklistCategory[]> {
  const response = await fetch(`${API_BASE_URL}/employee/tasks?storeId=${encodeURIComponent(storeId)}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to load today's checklist");
  }

  const categories: EmployeeChecklistCategoryDto[] = await response.json();
  return categories.map((category) => ({
    id: String(category.categoryId),
    name: category.categoryName,
    tasks: category.tasks.map((task) => ({ id: String(task.id), name: task.name })),
  }));
}

// TODO: no backend "raise issue with owner" endpoint exists yet — unrelated to the
// checklist-visibility fix, left as a mock until that feature is built.
export async function raiseIssue(_storeId: string, _note: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
}
