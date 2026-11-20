import { describe, expect, it } from 'vitest';
import { cardPageSize } from './useCardPageSize';

describe('cardPageSize', () => {
  it.each([
    [null, 12], // before the grid has measured itself
    [2, 12],    // phone: 6 rows of 2
    [4, 12],    // 3 rows of 4
    [5, 15],    // 3 full rows, never a part-filled one
    [6, 12],    // 2 rows of 6
    [7, 14],
    [10, 20],   // zoomed out: 2 rows of 10, no empty space
  ])('%s columns -> %s cards per page', (columns, size) => {
    expect(cardPageSize(columns)).toBe(size);
  });

  it('always fills whole rows', () => {
    for (let columns = 1; columns <= 16; columns += 1) {
      expect(cardPageSize(columns) % columns).toBe(0);
    }
  });
});
