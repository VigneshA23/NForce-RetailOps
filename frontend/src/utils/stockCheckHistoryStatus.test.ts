import { describe, expect, it } from 'vitest';
import { toStockCheckHistoryRowView } from './stockCheckHistoryStatus';
import type { StockCheckResponse, StockSnapshot } from '../types/stockCheck';

function snapshot(usable: number): StockSnapshot {
  return {
    available: usable, deadStock: 0, usable, enteredById: 1, enteredByName: 'Ananya', enteredAt: null,
    lastUpdatedByName: 'Ananya', lastUpdatedByAvatarUrl: null, lastUpdatedAt: null, edited: false,
  } as StockSnapshot;
}

function row(overrides: Partial<StockCheckResponse> = {}): StockCheckResponse {
  return {
    id: 1, storeInventoryItemId: 1, itemName: 'Butter', category: null, unitOfMeasurement: 'g', checkDate: '2026-10-14',
    requiredPar: 100, startOfDay: snapshot(300), endOfDay: null, stockUsed: null, requiredTomorrow: null,
    quantityToOrder: null, edits: [],
    ...overrides,
  } as StockCheckResponse;
}

describe('toStockCheckHistoryRowView', () => {
  it('is pending when End of Day was never counted', () => {
    expect(toStockCheckHistoryRowView(row()).status).toBe('pending');
  });

  it('is skipped when End of Day was explained as not countable', () => {
    const view = toStockCheckHistoryRowView(row({ endOfDaySkipped: { reason: 'freezer failed', byName: 'Ananya', at: null } }));
    expect(view.status).toBe('skipped');
    expect(view.counted).toBeNull();
  });

  it('is judged on the count once End of Day exists', () => {
    expect(toStockCheckHistoryRowView(row({ endOfDay: snapshot(40) })).status).toBe('shortage');
    expect(toStockCheckHistoryRowView(row({ endOfDay: snapshot(140) })).status).toBe('optimal');
  });
});
