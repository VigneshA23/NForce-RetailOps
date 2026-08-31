import { describe, expect, it } from 'vitest';
import { emptyTaskFormValues, validateTaskForm } from './adminTaskValidation';

function baseValues() {
  return {
    ...emptyTaskFormValues(),
    name: 'Wipe counters',
    categoryId: 1,
    appliesToAllStores: true,
    completionType: 'SINGLE' as const,
    scheduleType: 'EVERY_DAY' as const,
    startDate: '2026-01-01',
  };
}

describe('Display Order validation', () => {
  it('accepts an empty Display Order (optional field)', () => {
    const errors = validateTaskForm({ ...baseValues(), displayOrder: '' });
    expect(errors.displayOrder).toBeUndefined();
  });

  it('accepts a non-negative whole number', () => {
    const errors = validateTaskForm({ ...baseValues(), displayOrder: '4' });
    expect(errors.displayOrder).toBeUndefined();
  });

  it('accepts zero', () => {
    const errors = validateTaskForm({ ...baseValues(), displayOrder: '0' });
    expect(errors.displayOrder).toBeUndefined();
  });

  it('rejects a negative value', () => {
    const errors = validateTaskForm({ ...baseValues(), displayOrder: '-1' });
    expect(errors.displayOrder).toBe('Display Order cannot be negative');
  });

  it('rejects a non-integer value', () => {
    const errors = validateTaskForm({ ...baseValues(), displayOrder: '2.5' });
    expect(errors.displayOrder).toBe('Display Order must be a whole number');
  });
});
