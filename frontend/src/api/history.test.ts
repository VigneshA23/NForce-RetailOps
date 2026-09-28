import { describe, expect, it, vi, afterEach } from 'vitest';
import { getShiftHistory } from './history';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('getShiftHistory completedByAll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A MULTIPLE-completion task answered 3x by the SAME employee only ever has one
  // active response row (the backend supersedes the employee's own prior answer
  // each time) -- completedByAll must still surface all 3 submissions by walking
  // each response's own resubmissionHistory, not just the one still-active row.
  it('lists every same-day submission by a single employee, not just their latest', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        storeId: 1,
        storeName: 'Test Store',
        date: '2026-09-15',
        hasChecklist: true,
        categories: [
          {
            id: 10,
            name: 'Prep',
            active: true,
            tasks: [
              {
                id: 100,
                name: 'Prepare waffle cones - morning batch',
                description: null,
                responseType: 'NUMERIC',
                completionType: 'MULTIPLE',
                completed: true,
                currentlyActive: true,
                responses: [
                  {
                    id: 3,
                    employeeUserId: 5,
                    employeeFullName: 'Alice Caller',
                    empId: 'EMP-001',
                    booleanValue: null,
                    numericValue: 9,
                    textValue: null,
                    respondedAt: '2026-09-15T18:00:00Z',
                    latestCorrection: null,
                    resubmissionHistory: [
                      {
                        responseId: 1,
                        booleanValue: null,
                        numericValue: 3,
                        textValue: null,
                        respondedAt: '2026-09-15T14:00:00Z',
                        employeeFullName: 'Alice Caller',
                        flagReason: null,
                        flaggedByName: null,
                        flaggedAt: null,
                      },
                      {
                        responseId: 2,
                        booleanValue: null,
                        numericValue: 6,
                        textValue: null,
                        respondedAt: '2026-09-15T16:00:00Z',
                        employeeFullName: 'Alice Caller',
                        flagReason: null,
                        flaggedByName: null,
                        flaggedAt: null,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        issues: [],
      }),
    );

    const result = await getShiftHistory(1, '2026-09-15');
    const task = result.categories[0].tasks[0];

    expect(task.completedByAll).toHaveLength(3);
    expect(task.completedByAll.every((responder) => responder.name === 'Alice Caller')).toBe(true);
  });
});

describe('getShiftHistory inactive tasks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function baseTask(overrides: Record<string, unknown> = {}) {
    return {
      id: 100,
      name: 'Check float cash in till',
      description: null,
      responseType: 'YES_NO',
      completionType: 'SINGLE',
      completed: true,
      currentlyActive: true,
      responses: [
        {
          id: 1,
          employeeUserId: 5,
          employeeFullName: 'Alice Caller',
          empId: 'EMP-001',
          booleanValue: true,
          numericValue: null,
          textValue: null,
          respondedAt: '2026-09-15T18:00:00Z',
          latestCorrection: null,
          resubmissionHistory: [],
        },
      ],
      ...overrides,
    };
  }

  // Regression test: a task deactivated mid-day after being answered must
  // still surface here as 'INACTIVE', with its recorded response preserved,
  // instead of being dropped or misreported as Complete/Flagged.
  it('marks a deactivated task as INACTIVE while keeping its response value', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        storeId: 1,
        storeName: 'Test Store',
        date: '2026-09-15',
        hasChecklist: true,
        categories: [{ id: 10, name: 'Opening', active: true, tasks: [baseTask({ currentlyActive: false })] }],
        issues: [],
      }),
    );

    const result = await getShiftHistory(1, '2026-09-15');
    const category = result.categories[0];
    const task = category.tasks[0];

    expect(task.status).toBe('INACTIVE');
    expect(task.responseValue).toBe('Yes');
    // Excluded from the category's completed/total tally, not counted as done.
    expect(category.tasksTotal).toBe(0);
    expect(category.tasksCompleted).toBe(0);
  });

  // A deactivated CATEGORY vetoes every task under it too, even if the task's
  // own currentlyActive still reads true.
  it('marks a task as INACTIVE when only its category has been deactivated', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        storeId: 1,
        storeName: 'Test Store',
        date: '2026-09-15',
        hasChecklist: true,
        categories: [{ id: 10, name: 'Opening', active: false, tasks: [baseTask({ currentlyActive: true })] }],
        issues: [],
      }),
    );

    const result = await getShiftHistory(1, '2026-09-15');
    expect(result.categories[0].tasks[0].status).toBe('INACTIVE');
  });

  it('leaves an active task with a normal Complete/Flagged/Not answered status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        storeId: 1,
        storeName: 'Test Store',
        date: '2026-09-15',
        hasChecklist: true,
        categories: [{ id: 10, name: 'Opening', active: true, tasks: [baseTask()] }],
        issues: [],
      }),
    );

    const result = await getShiftHistory(1, '2026-09-15');
    expect(result.categories[0].tasks[0].status).toBe('YES');
  });
});
