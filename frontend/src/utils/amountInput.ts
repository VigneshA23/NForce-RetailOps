// Shared checks for the money inputs on the cash screens (Daily Cash Entry,
// Cash Drawer Target). They mirror the backend's rules for every amount:
// required, numeric, at most 10 whole digits and 2 decimals, and
// non-negative unless the field is explicitly signed.

const AMOUNT_PATTERN = /^-?(\d{1,10}(\.\d{0,2})?|\.\d{1,2})$/;
const NUMBER_PATTERN = /^-?(\d+(\.\d*)?|\.\d+)$/;

// Commas are display-only (formatAmount adds them on blur), so ignore them.
export function normaliseAmount(raw: string): string {
  return raw.trim().replace(/,/g, '');
}

interface AmountRules {
  // Allows a leading minus sign.
  signed?: boolean;
  // Replaces the default "<label> is required".
  requiredMessage?: string;
}

// The message to show for `raw`, or undefined when it's a valid amount.
export function validateAmount(label: string, raw: string, { signed = false, requiredMessage }: AmountRules = {}): string | undefined {
  const value = normaliseAmount(raw);
  if (value === '') return requiredMessage ?? `${label} is required`;
  if (!NUMBER_PATTERN.test(value)) return `${label} must be a number, e.g. 125.50`;
  if (!signed && value.startsWith('-')) return `${label} cannot be negative`;
  if (!AMOUNT_PATTERN.test(value)) {
    const [whole = '', fraction = ''] = value.replace('-', '').split('.');
    return fraction.length > 2 ? 'Use at most 2 decimal places' : whole.length > 10 ? 'Amount is too large' : `${label} must be a number, e.g. 125.50`;
  }
  return undefined;
}

// Drops any digits typed or pasted beyond the second decimal place, so the
// field can never hold more than 2 decimals.
export function limitDecimals(raw: string): string {
  return raw.replace(/(\.\d{2})\d+/, '$1');
}

// Checklist numeric answers: digits and at most one dot, no sign, letters or
// symbols, at most 5 digits before and 3 after the decimal point. Applied
// as the user types or pastes, so the field can never hold anything else.
export function sanitizeChecklistNumber(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned.slice(0, 5)
  const whole = cleaned.slice(0, dot).slice(0, 5)
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 3)
  return `${whole}.${fraction}`
}

// Only call on a value validateAmount accepted.
export function parseAmount(raw: string): number {
  return Number(normaliseAmount(raw));
}
