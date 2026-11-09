import { describe, expect, it } from 'vitest';
import { parseAmount, validateAmount } from './amountInput';

describe('validateAmount', () => {
  it('accepts plain, decimal and comma-grouped amounts', () => {
    expect(validateAmount('Target', '150')).toBeUndefined();
    expect(validateAmount('Target', '150.5')).toBeUndefined();
    expect(validateAmount('Target', '.75')).toBeUndefined();
    expect(validateAmount('Target', '1,234.56')).toBeUndefined();
  });

  it('explains each kind of bad input', () => {
    expect(validateAmount('Target', '  ')).toBe('Target is required');
    expect(validateAmount('Target', '', { requiredMessage: 'Enter 0 if none' })).toBe('Enter 0 if none');
    expect(validateAmount('Target', 'abc')).toBe('Target must be a number, e.g. 125.50');
    expect(validateAmount('Target', '-5')).toBe('Target cannot be negative');
    expect(validateAmount('Target', '1.234')).toBe('Use at most 2 decimal places');
    expect(validateAmount('Target', '12345678901')).toBe('Amount is too large');
  });

  it('allows a minus sign only for signed fields', () => {
    expect(validateAmount('Adjustment', '-12.5', { signed: true })).toBeUndefined();
  });
});

describe('parseAmount', () => {
  it('drops commas and whitespace', () => {
    expect(parseAmount(' 1,234.50 ')).toBe(1234.5);
  });
});
