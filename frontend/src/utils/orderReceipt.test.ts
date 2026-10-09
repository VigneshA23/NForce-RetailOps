import { describe, expect, it } from 'vitest';
import { describeReceipt } from './orderReceipt';

describe('describeReceipt', () => {
  it('says so when no stock count existed to add the delivery to', () => {
    const result = describeReceipt('Milk', 5, 'L', { stockUpdated: false, currentStock: null, requiredToday: 10, shortfall: null });

    expect(result.tone).toBe('info');
    expect(result.message).toBe('"Milk" received 5 L. No stock count for today yet, so current stock was not updated.');
  });

  it('reports the minimum as met when there is no shortfall', () => {
    const result = describeReceipt('Milk', 5, 'L', { stockUpdated: true, currentStock: 12, requiredToday: 10, shortfall: 0 });

    expect(result.tone).toBe('success');
    expect(result.message).toBe('"Milk" received 5 L. Stock is now 12 L, meeting today\'s minimum of 10 L.');
  });

  it('reports the remaining shortfall against today\'s minimum', () => {
    const result = describeReceipt('Milk', 3.5, 'L', { stockUpdated: true, currentStock: 6, requiredToday: 10, shortfall: 4 });

    expect(result.tone).toBe('info');
    expect(result.message).toBe('"Milk" received 3.5 L. Stock is now 6 L, still 4 L below today\'s minimum of 10 L.');
  });

  it('treats a missing receipt like an un-updated one', () => {
    expect(describeReceipt('Milk', null, 'L', null).tone).toBe('info');
  });
});
