import { describe, expect, it } from 'vitest';
import { taskStatus } from './checklistHistoryOptions';
import type { ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';

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
