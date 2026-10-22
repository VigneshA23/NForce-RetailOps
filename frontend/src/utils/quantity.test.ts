import { describe, expect, it } from 'vitest';
import { isQtyInputAllowed, parseQty, roundQty } from './quantity';

describe('quantity input rules', () => {
  it('allows up to 4 digits and 2 decimals for measured units', () => {
    expect(isQtyInputAllowed('1234.56', 'kg')).toBe(true);
    expect(isQtyInputAllowed('1.', 'kg')).toBe(true);
    expect(isQtyInputAllowed('1.234', 'kg')).toBe(false);
    expect(isQtyInputAllowed('12345', 'kg')).toBe(false);
    expect(parseQty('12.5', 'kg')).toBe(12.5);
    expect(parseQty('12.345', 'kg')).toBeNull();
  });

  it('allows whole numbers only for countable units', () => {
    expect(isQtyInputAllowed('1234', 'Nos.')).toBe(true);
    expect(isQtyInputAllowed('1.5', 'Nos.')).toBe(false);
  });

  it('rounds to 2 decimals', () => {
    expect(roundQty(1.005 + 0.2)).toBe(1.21);
  });
});
