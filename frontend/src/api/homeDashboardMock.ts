// Mock data source for the owner dashboard's Home page charts (completion trend,
// category breakdown, per-store ranking). Split out from api/history.ts when that
// module's getShiftHistory became the real employee-facing history endpoint
// (GET /api/me/history/detail): Home's aggregate, multi-store, owner-facing charts
// have no backend endpoint of their own yet, and the employee endpoint can't serve
// them anyway (it's scoped to one employee's assigned store via
// requireAssignedStore, which no owner satisfies) -- so they keep using
// deterministic mock data here instead.

const SIMULATED_LATENCY_MS = 150;

const CATEGORY_DEFS = [
  { id: 'preparation', name: 'Preparation', taskCount: 3 },
  { id: 'cleaning', name: 'Cleaning', taskCount: 2 },
  { id: 'closing', name: 'Closing', taskCount: 2 },
];

export interface HomeMockCategorySummary {
  id: string;
  name: string;
  tasksCompleted: number;
  tasksTotal: number;
}

export interface HomeMockShiftHistory {
  storeId: number;
  date: string;
  categories: HomeMockCategorySummary[];
  summary: { onTimePercent: number };
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildMockHistory(storeId: number, date: string): HomeMockShiftHistory {
  const seed = hashSeed(`${storeId}-${date}`);
  const categories = CATEGORY_DEFS.map((def, index) => {
    const categorySeed = seed + index * 97;
    const missed = categorySeed % 5 === 0 ? 1 : 0;
    const tasksCompleted = Math.max(0, def.taskCount - missed);
    return { id: def.id, name: def.name, tasksCompleted, tasksTotal: def.taskCount };
  });

  const totalTasks = categories.reduce((sum, category) => sum + category.tasksTotal, 0);
  const totalCompleted = categories.reduce((sum, category) => sum + category.tasksCompleted, 0);
  const onTimePercent = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);

  return { storeId, date, categories, summary: { onTimePercent } };
}

export async function getMockShiftHistory(storeId: number, date: string): Promise<HomeMockShiftHistory> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(buildMockHistory(storeId, date)), SIMULATED_LATENCY_MS);
  });
}
