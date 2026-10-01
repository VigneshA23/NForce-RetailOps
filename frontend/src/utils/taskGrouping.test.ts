import { describe, expect, it } from 'vitest';
import { groupTasksByName } from './taskGrouping';
import type { AdminTask } from '../types/adminTask';

function task(overrides: Partial<AdminTask> = {}): AdminTask {
  return {
    id: 1,
    ownerId: 100,
    name: 'Unlock entrance and disable alarms',
    description: null,
    categoryId: 1,
    categoryName: 'Opening Checks',
    displayOrder: 0,
    appliesToAllStores: false,
    stores: [{ id: 1, name: 'Store 1' }],
    responseType: 'YES_NO',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: null,
    completionType: 'SINGLE',
    maxCompletions: null,
    scheduleType: 'EVERY_DAY',
    selectedDays: [],
    startDate: '2026-01-01',
    endDate: null,
    timeMode: 'ANYTIME',
    startTime: null,
    endTime: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupTasksByName', () => {
  it('leaves a unique-titled task unchanged, mapped to just itself', () => {
    const solo = task({ id: 1, name: 'Solo task' });
    const { displayTasks, memberIdsByDisplayId } = groupTasksByName([solo]);

    expect(displayTasks).toEqual([solo]);
    expect(memberIdsByDisplayId.get(1)).toEqual([1]);
  });

  it('merges two same-titled rows into one, unioning their stores', () => {
    const a = task({ id: 1, stores: [{ id: 10, name: 'Store A' }] });
    const b = task({ id: 2, stores: [{ id: 20, name: 'Store B' }] });

    const { displayTasks, memberIdsByDisplayId } = groupTasksByName([a, b]);

    expect(displayTasks).toHaveLength(1);
    const merged = displayTasks[0];
    expect(merged.stores.map((s) => s.id).sort()).toEqual([10, 20]);
    expect(memberIdsByDisplayId.get(merged.id)?.sort()).toEqual([1, 2]);
  });

  it('shows a merged row as active if any underlying member is active', () => {
    const inactive = task({ id: 1, active: false });
    const active = task({ id: 2, active: true });

    const { displayTasks } = groupTasksByName([inactive, active]);

    expect(displayTasks).toHaveLength(1);
    expect(displayTasks[0].active).toBe(true);
    expect(displayTasks[0].id).toBe(2); // the active member is preferred as primary
  });

  it('shows a merged row as applying to all stores if any underlying member does', () => {
    const scoped = task({ id: 1, appliesToAllStores: false, stores: [{ id: 10, name: 'Store A' }] });
    const allStores = task({ id: 2, appliesToAllStores: true, stores: [] });

    const { displayTasks } = groupTasksByName([scoped, allStores]);

    expect(displayTasks[0].appliesToAllStores).toBe(true);
  });

  it('does not merge tasks with different titles', () => {
    const a = task({ id: 1, name: 'Task A' });
    const b = task({ id: 2, name: 'Task B' });

    const { displayTasks, memberIdsByDisplayId } = groupTasksByName([a, b]);

    expect(displayTasks).toHaveLength(2);
    expect(memberIdsByDisplayId.get(1)).toEqual([1]);
    expect(memberIdsByDisplayId.get(2)).toEqual([2]);
  });

  // Regression test for the real bug this found: a seeded/parallel dataset
  // where three DIFFERENT owners each independently configured their own
  // "Turn off equipment and lights" task -- these are not accidental
  // duplicates and must never be blended into one row, even though they
  // share a title. Title-only grouping previously merged them and picked
  // whichever owner's copy happened to be active as if it applied everywhere.
  it('does not merge same-titled tasks belonging to different owners', () => {
    const plano = task({ id: 44, ownerId: 57, active: false, categoryName: 'Closing Checks' });
    const friscoo = task({ id: 63, ownerId: 58, active: false, categoryName: 'Closing Checks' });
    const murphy = task({ id: 82, ownerId: 59, active: true, categoryName: 'Opening Checks' });

    const { displayTasks, memberIdsByDisplayId } = groupTasksByName([plano, friscoo, murphy]);

    expect(displayTasks).toHaveLength(3);
    expect(memberIdsByDisplayId.get(44)).toEqual([44]);
    expect(memberIdsByDisplayId.get(63)).toEqual([63]);
    expect(memberIdsByDisplayId.get(82)).toEqual([82]);
    // Each owner's own active/category state is preserved, not blended away.
    expect(displayTasks.find((t) => t.id === 63)?.active).toBe(false);
    expect(displayTasks.find((t) => t.id === 82)?.active).toBe(true);
  });

  it('still merges same-titled, same-owner rows (the real accidental-duplicate case)', () => {
    const a = task({ id: 105, ownerId: 58, active: true });
    const b = task({ id: 112, ownerId: 58, active: true });

    const { displayTasks, memberIdsByDisplayId } = groupTasksByName([a, b]);

    expect(displayTasks).toHaveLength(1);
    expect(memberIdsByDisplayId.get(displayTasks[0].id)?.sort()).toEqual([105, 112]);
  });

  it('dedupes a store that appears in both underlying members', () => {
    const shared = { id: 10, name: 'Shared Store' };
    const a = task({ id: 1, stores: [shared] });
    const b = task({ id: 2, stores: [shared, { id: 20, name: 'Store B' }] });

    const { displayTasks } = groupTasksByName([a, b]);

    expect(displayTasks[0].stores).toHaveLength(2);
  });
});
