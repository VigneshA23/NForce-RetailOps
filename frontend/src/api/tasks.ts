import type { ChecklistCategory } from '../types/task';

const MOCK_CHECKLIST: ChecklistCategory[] = [
  {
    id: 'preparation',
    name: 'Preparation',
    tasks: [
      { id: 'prep-1', name: 'Prepare Boba' },
      { id: 'prep-2', name: 'Refill Falooda Station' },
      { id: 'prep-3', name: 'Prepare Waffle Cones' },
    ],
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    tasks: [
      { id: 'clean-1', name: 'Clean Front Door' },
      { id: 'clean-2', name: 'Clean Tables' },
    ],
  },
  {
    id: 'closing',
    name: 'Closing',
    tasks: [
      { id: 'close-1', name: 'Verify Freezer Doors' },
      { id: 'close-2', name: 'Turn Off Equipment' },
    ],
  },
];

const SIMULATED_LATENCY_MS = 200;

// TODO: the backend Category API (/api/categories) is owner-scoped and OWNER_ADMIN-only,
// and there is no Task/Checklist entity yet. Once the backend exposes store-scoped
// categories + tasks for the authenticated employee, replace MOCK_CHECKLIST with a fetch
// against `${VITE_API_BASE_URL}/api/stores/${storeId}/checklist` (or similar) and drop
// this mock entirely.
export async function getDailyChecklist(_storeId: string): Promise<ChecklistCategory[]> {
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(MOCK_CHECKLIST.map((category) => ({ ...category, tasks: category.tasks.map((task) => ({ ...task })) }))),
      SIMULATED_LATENCY_MS,
    );
  });
}

// TODO: replace with a real "raise issue with owner" endpoint once one exists on the backend.
export async function raiseIssue(_storeId: string, _note: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SIMULATED_LATENCY_MS);
  });
}
