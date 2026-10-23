// Stock quantities: up to 4 digits before the decimal point and 2 after
// (e.g. 1234.56 kg). The backend's @Digits(integer = 4, fraction = 3) and
// NUMERIC(12,3) columns are wider, so anything allowed here is accepted there.
// Countable units (Nos., boxes, bottles...) take whole numbers only.

export const QUANTITY_INTEGER_DIGITS = 4;
export const QUANTITY_DECIMALS = 2;

const WHOLE_NUMBER_UNITS = new Set([
  'nos', 'no', 'number', 'numbers', 'pcs', 'pc', 'piece', 'pieces',
  'box', 'boxes', 'bottle', 'bottles', 'pack', 'packs', 'packet', 'packets',
  'can', 'cans', 'bag', 'bags', 'carton', 'cartons', 'case', 'cases', 'unit', 'units',
]);

// Whole-number units Super Admin added at runtime (loaded from the server).
let customWholeNumberUnits = new Set<string>();

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\.$/, '');
}

export function registerWholeNumberUnits(units: string[]): void {
  customWholeNumberUnits = new Set(units.map(normalizeUnit));
}

// True for countable units, which can't be split: 'Nos.', box, bottle, ...
export function isWholeNumberUnit(unit?: string | null): boolean {
  if (!unit) return false;
  const key = normalizeUnit(unit);
  return WHOLE_NUMBER_UNITS.has(key) || customWholeNumberUnits.has(key);
}

function patternFor(unit?: string | null): RegExp {
  return isWholeNumberUnit(unit)
    ? new RegExp(`^\\d{0,${QUANTITY_INTEGER_DIGITS}}$`)
    : new RegExp(`^\\d{0,${QUANTITY_INTEGER_DIGITS}}(\\.\\d{0,${QUANTITY_DECIMALS}})?$`);
}

// For onChange handlers: true if the text typed so far is an allowed prefix
// of a valid quantity (a half-typed "1." passes; letters, a 5th integer digit,
// a 4th decimal, or any decimal for a countable unit do not).
export function isQtyInputAllowed(text: string, unit?: string | null): boolean {
  return text === '' || patternFor(unit).test(text);
}

// Rounds away float noise from arithmetic like 1.1 + 0.2.
export function roundQty(value: number): number {
  const factor = 10 ** QUANTITY_DECIMALS;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// Parses typed text into a quantity: >= 0, at most 4 integer digits and 2
// decimals (none for countable units). Returns null for empty / invalid input.
export function parseQty(text: string, unit?: string | null): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.endsWith('.') || !patternFor(unit).test(trimmed)) return null;
  return Number(trimmed);
}

// Human wording of the rule, for validation messages.
export function qtyRuleHint(unit?: string | null): string {
  return isWholeNumberUnit(unit)
    ? 'a whole number (up to 4 digits)'
    : 'a number (up to 4 digits, with up to 2 decimals)';
}

// Display form: whole numbers stay "5", fractions show as typed up to two
// places ("1.25", "1.5") -- no trailing zeros.
export function formatQty(value: number | null | undefined): string {
  if (value == null) return '';
  return String(roundQty(value));
}
