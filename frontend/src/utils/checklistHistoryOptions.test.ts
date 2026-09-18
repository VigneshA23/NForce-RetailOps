import { describe, expect, it } from 'vitest';
import { stepDate, lastWeekSameDay } from './checklistHistoryOptions';

// Regression: stepDate used to build its result with `.toISOString().slice(0, 10)`,
// which renders in UTC. In any timezone ahead of UTC (this suite runs in
// Asia/Calcutta, UTC+5:30 -- the same one production runs in), local midnight
// lands on the *previous* UTC calendar day, so every step landed one day short.
// That made the "next day" arrow (stepDate(date, 1)) return the same date it
// started from -- looking completely broken -- while "previous day" merely
// over-shot by an extra day.
describe('stepDate', () => {
  it('moves forward exactly one day', () => {
    expect(stepDate('2026-09-18', 1)).toBe('2026-09-19');
  });

  it('moves backward exactly one day', () => {
    expect(stepDate('2026-09-18', -1)).toBe('2026-09-17');
  });

  it('round-trips forward then backward to the same date', () => {
    const forward = stepDate('2026-09-18', 1);
    expect(stepDate(forward, -1)).toBe('2026-09-18');
  });

  it('crosses a month boundary correctly', () => {
    expect(stepDate('2026-09-30', 1)).toBe('2026-10-01');
  });
});

describe('lastWeekSameDay', () => {
  it('moves back exactly seven days', () => {
    expect(lastWeekSameDay('2026-09-18')).toBe('2026-09-11');
  });
});
