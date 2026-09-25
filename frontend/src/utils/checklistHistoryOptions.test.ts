import { describe, expect, it } from 'vitest';
import {
  taskStatus, previousCalendarWeekRange, datesInRange, todayDate, yesterday,
  visibleCategoriesForLiveView, inactiveTasksWithHistory,
} from './checklistHistoryOptions';
import type { ChecklistHistoryCategory, ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';

function response(overrides: Partial<ChecklistHistoryResponseEntry> = {}): ChecklistHistoryResponseEntry {
  return {
    id: 1,
    employeeUserId: 1,
    employeeFullName: 'Jane Doe',
    empId: 'EMP-001',
    booleanValue: true,
    numericValue: null,
    textValue: null,
    respondedAt: '2026-09-18T10:00:00Z',
    latestCorrection: null,
    flaggedNeedsCorrection: false,
    flagReason: null,
    resubmissionHistory: [],
    undone: false,
    ...overrides,
  };
}

function task(overrides: Partial<ChecklistHistoryTaskItem> = {}): ChecklistHistoryTaskItem {
  return {
    id: 10,
    name: 'Clean counter',
    description: null,
    responseType: 'YES_NO',
    completionType: 'SINGLE',
    scheduleType: 'EVERY_DAY',
    numericUnit: null,
    completed: false,
    currentlyActive: true,
    totalActiveEmployees: 1,
    deactivatedByName: null,
    deactivatedAt: null,
    responses: [],
    ...overrides,
  };
}

describe('taskStatus', () => {
  it('is OPEN with no responses', () => {
    expect(taskStatus(task({ responses: [] }))).toBe('OPEN');
  });

  it('is COMPLETE for a SINGLE-completion task with one response', () => {
    expect(taskStatus(task({ completionType: 'SINGLE', responses: [response()] }))).toBe('COMPLETE');
  });

  // Regression test for the reported bug: a MULTIPLE-completion task must stay
  // Open after only one employee's response.
  it('is OPEN for a MULTIPLE-completion task with only one response', () => {
    const result = taskStatus(
      task({ completionType: 'MULTIPLE', responses: [response({ employeeUserId: 1 })] })
    );
    expect(result).toBe('OPEN');
  });

  it('is COMPLETE for a MULTIPLE-completion task once a second distinct employee responds', () => {
    const result = taskStatus(
      task({
        completionType: 'MULTIPLE',
        responses: [
          response({ id: 1, employeeUserId: 1 }),
          response({ id: 2, employeeUserId: 2 }),
        ],
      })
    );
    expect(result).toBe('COMPLETE');
  });

  it('stays OPEN for a MULTIPLE-completion task when the same employee resubmits twice', () => {
    const result = taskStatus(
      task({
        completionType: 'MULTIPLE',
        responses: [
          response({ id: 1, employeeUserId: 1, undone: true }),
          response({ id: 2, employeeUserId: 1 }),
        ],
      })
    );
    expect(result).toBe('OPEN');
  });

  it('is OPEN when the latest response was undone', () => {
    expect(taskStatus(task({ responses: [response({ undone: true })] }))).toBe('OPEN');
  });

  it('is ISSUE for a Yes/No task whose latest response is No', () => {
    const result = taskStatus(
      task({ responseType: 'YES_NO', responses: [response({ booleanValue: false })] })
    );
    expect(result).toBe('ISSUE');
  });
});

function category(overrides: Partial<ChecklistHistoryCategory> = {}): ChecklistHistoryCategory {
  return {
    id: 1,
    name: 'Category',
    active: true,
    deactivatedByName: null,
    deactivatedAt: null,
    tasks: [],
    ...overrides,
  };
}

describe('visibleCategoriesForLiveView', () => {
  it('drops an inactive category entirely', () => {
    const categories = [
      category({ active: false, tasks: [task({ id: 1 })] }),
      category({ id: 2, active: true, tasks: [task({ id: 2 })] }),
    ];
    const result = visibleCategoriesForLiveView(categories);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('drops an inactive task from an otherwise-active category', () => {
    const categories = [
      category({ tasks: [task({ id: 1, currentlyActive: false }), task({ id: 2, currentlyActive: true })] }),
    ];
    const result = visibleCategoriesForLiveView(categories);
    expect(result).toHaveLength(1);
    expect(result[0].tasks.map((t) => t.id)).toEqual([2]);
  });

  it('drops a category entirely once every task under it is inactive', () => {
    const categories = [category({ tasks: [task({ id: 1, currentlyActive: false })] })];
    expect(visibleCategoriesForLiveView(categories)).toHaveLength(0);
  });
});

describe('inactiveTasksWithHistory', () => {
  it('excludes a deactivated task with zero response history (fully hidden)', () => {
    const categories = [category({ tasks: [task({ id: 1, currentlyActive: false, responses: [] })] })];
    expect(inactiveTasksWithHistory(categories)).toHaveLength(0);
  });

  it('includes a deactivated task that has at least one recorded response', () => {
    const categories = [
      category({ tasks: [task({ id: 1, currentlyActive: false, responses: [response()] })] }),
    ];
    const result = inactiveTasksWithHistory(categories);
    expect(result).toHaveLength(1);
    expect(result[0].deactivatedScope).toBe('TASK');
  });

  it('attributes the deactivation to the category when the category itself is inactive', () => {
    const categories = [
      category({
        active: false,
        deactivatedByName: 'Super Admin',
        deactivatedAt: '2026-09-20T10:00:00Z',
        tasks: [task({ id: 1, currentlyActive: true, responses: [response()] })],
      }),
    ];
    const result = inactiveTasksWithHistory(categories);
    expect(result).toHaveLength(1);
    expect(result[0].deactivatedScope).toBe('CATEGORY');
    expect(result[0].deactivatedByName).toBe('Super Admin');
  });
});

describe('previousCalendarWeekRange', () => {
  // Regression test for the reported bug: "Last Week" from a Thursday must
  // return the full prior Mon-Sun span, not a single day 7 days back.
  it('returns the complete previous Monday-Sunday week from a Thursday', () => {
    expect(previousCalendarWeekRange('2026-09-24')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
  });

  it('does not collapse to a single day', () => {
    const range = previousCalendarWeekRange('2026-09-24');
    expect(range.start).not.toBe(range.end);
    expect(datesInRange(range)).toHaveLength(7);
  });

  it('is anchored to Monday-Sunday regardless of which weekday the reference date is', () => {
    // Monday, Saturday, and Sunday of the SAME week (Sep 21-27) must all
    // resolve to the same previous week -- the range must not depend on
    // which weekday within the current week the reference date falls on.
    expect(previousCalendarWeekRange('2026-09-21')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
    expect(previousCalendarWeekRange('2026-09-26')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
    expect(previousCalendarWeekRange('2026-09-27')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
  });

  it('works across a month boundary', () => {
    // Wednesday Oct 1, 2026 -- this week starts Mon Sep 28, so last week is Sep 21-27.
    expect(previousCalendarWeekRange('2026-10-01')).toEqual({ start: '2026-09-21', end: '2026-09-27' });
  });

  it('works across a year boundary', () => {
    // Wednesday Jan 7, 2026 -- this week starts Mon Jan 5, so last week is Dec 29, 2025 - Jan 4, 2026.
    expect(previousCalendarWeekRange('2026-01-07')).toEqual({ start: '2025-12-29', end: '2026-01-04' });
  });
});

describe('datesInRange', () => {
  it('lists every date inclusive of both endpoints', () => {
    expect(datesInRange({ start: '2026-09-14', end: '2026-09-20' })).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
      '2026-09-18', '2026-09-19', '2026-09-20',
    ]);
  });

  it('returns a single date for a same-day range (Today/Yesterday remain single-day filters)', () => {
    expect(datesInRange({ start: todayDate(), end: todayDate() })).toEqual([todayDate()]);
    expect(datesInRange({ start: yesterday(), end: yesterday() })).toEqual([yesterday()]);
  });
});
