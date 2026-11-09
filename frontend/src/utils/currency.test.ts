import { describe, expect, it } from 'vitest';
import { formatAmount, formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('always shows two decimals and thousands separators', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('puts the minus sign before the dollar sign', () => {
    expect(formatCurrency(-12.5)).toBe('-$12.50');
  });
});

describe('formatAmount', () => {
  it('formats like formatCurrency without the symbol', () => {
    expect(formatAmount(1234.5)).toBe('1,234.50');
    expect(formatAmount(-12.5)).toBe('-12.50');
  });
});
