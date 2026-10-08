// Stock quantities (kg, litres, ...) accept up to two decimal places, e.g.
// 1.25 or 1.50 -- matching the backend's NUMERIC(12,2) columns.

export const QUANTITY_DECIMALS = 2;

// Rounds away float noise from arithmetic like 1.1 + 0.2.
export function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Parses typed text into a quantity: >= 0 with at most two decimal places.
// Returns null for empty / invalid input.
export function parseQty(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Number(trimmed);
}

// Display form: whole numbers stay "5", fractions show as typed up to two
// places ("1.25", "1.5") -- no trailing ".00".
export function formatQty(value: number | null | undefined): string {
  if (value == null) return '';
  return String(roundQty(value));
}
