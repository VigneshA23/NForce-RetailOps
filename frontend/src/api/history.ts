import type { DailySummary, HistoryCategoryEntry, HistoryStaffMember, HistoryTaskDetail, ShiftHistory } from '../types/history';

const SIMULATED_LATENCY_MS = 200;

const STAFF_POOL: HistoryStaffMember[] = [
  { id: 'staff-1', name: 'Aisha Lopez', initials: 'AL' },
  { id: 'staff-2', name: 'Marcus Reed', initials: 'MR' },
  { id: 'staff-3', name: 'Jordan Diaz', initials: 'JD' },
  { id: 'staff-4', name: 'Priya Nair', initials: 'PN' },
];

interface CategoryDef {
  id: string;
  name: string;
  taskNames: string[];
  completedAtTime: string;
  scheduledForTime: string;
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'preparation',
    name: 'Preparation',
    taskNames: ['Prepare Boba', 'Refill Falooda Station', 'Prepare Waffle Cones'],
    completedAtTime: '10:15 AM',
    scheduledForTime: '9:00 AM',
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    taskNames: ['Clean Front Door', 'Clean Tables'],
    completedAtTime: '2:30 PM',
    scheduledForTime: '2:00 PM',
  },
  {
    id: 'closing',
    name: 'Closing',
    taskNames: ['Verify Freezer Doors', 'Turn Off Equipment'],
    completedAtTime: '8:45 PM',
    scheduledForTime: '9:00 PM',
  },
];

function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildCategory(def: CategoryDef, categoryIndex: number, seed: number, isInProgress: boolean): HistoryCategoryEntry {
  if (isInProgress) {
    return {
      id: def.id,
      name: def.name,
      completedAt: null,
      scheduledFor: def.scheduledForTime,
      auditStatus: 'NOT_AUDITED',
      auditedBy: null,
      auditNote: null,
      tasksCompleted: 0,
      tasksTotal: def.taskNames.length,
      staff: [],
      tasks: def.taskNames.map((name, taskIndex) => ({
        id: `${def.id}-${taskIndex + 1}`,
        name,
        status: 'NOT_ANSWERED',
        completedBy: null,
        completedAt: null,
      })),
    };
  }

  const tasks: HistoryTaskDetail[] = def.taskNames.map((name, taskIndex) => {
    const taskSeed = seed + categoryIndex * 97 + taskIndex * 13;
    const missed = taskSeed % 11 === 0;
    const staffMember = STAFF_POOL[taskSeed % STAFF_POOL.length];
    return {
      id: `${def.id}-${taskIndex + 1}`,
      name,
      status: missed ? 'NO' : 'YES',
      completedBy: missed ? null : staffMember,
      completedAt: missed ? null : def.completedAtTime,
    };
  });

  const tasksCompleted = tasks.filter((task) => task.status === 'YES').length;
  const staffIds = new Set(tasks.map((task) => task.completedBy?.id).filter((id): id is string => Boolean(id)));
  const staff = STAFF_POOL.filter((member) => staffIds.has(member.id));

  const auditRoll = (seed + categoryIndex * 7) % 3;
  const auditStatus = auditRoll === 0 ? 'AUDITED' : auditRoll === 1 ? 'PENDING_AUDIT' : 'NOT_AUDITED';
  const auditor = STAFF_POOL[(seed + categoryIndex * 3) % STAFF_POOL.length];

  return {
    id: def.id,
    name: def.name,
    completedAt: def.completedAtTime,
    scheduledFor: null,
    auditStatus,
    auditedBy: auditStatus === 'AUDITED' ? auditor.name : null,
    auditNote: auditStatus === 'AUDITED' ? 'All checklist items verified against store standards.' : null,
    tasksCompleted,
    tasksTotal: tasks.length,
    staff,
    tasks,
  };
}

function buildMockHistory(storeId: string, date: string): ShiftHistory {
  const seed = hashSeed(`${storeId}-${date}`);
  const isToday = date === todayDate();
  const categories = CATEGORY_DEFS.map((def, index) => {
    // For the current day, the last (closing) category hasn't happened yet.
    const isInProgress = isToday && index === CATEGORY_DEFS.length - 1;
    return buildCategory(def, index, seed, isInProgress);
  });

  const totalTasks = categories.reduce((sum, category) => sum + category.tasksTotal, 0);
  const totalCompleted = categories.reduce((sum, category) => sum + category.tasksCompleted, 0);
  const audits = categories.filter((category) => category.auditStatus === 'AUDITED').length;
  const onTimePercent = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);

  const summary: DailySummary = { onTimePercent, totalTasks, audits };

  return { date, storeId, categories, summary };
}

// TODO: there is no backend endpoint yet for daily-shift/task history (no Task,
// completion, or audit table exists). Once the backend exposes something like
// `${VITE_API_BASE_URL}/api/stores/${storeId}/history?date=${date}`, replace this
// mock and drop buildMockHistory entirely. The mock is deterministic per
// (storeId, date) so the store/date filters behave consistently.
export async function getShiftHistory(storeId: string, date: string): Promise<ShiftHistory> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(buildMockHistory(storeId, date)), SIMULATED_LATENCY_MS);
  });
}
