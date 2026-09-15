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
