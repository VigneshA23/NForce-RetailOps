// The one money formatter for every cash screen: US dollars, always two
// decimals, thousands separators -- 1234.5 -> "$1,234.50". Negative amounts
// (signed adjustments) render as "-$12.50".
const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Same rounding and separators without the symbol, for inputs that already
// show a "$" beside the field -- 1234.5 -> "1,234.50".
const AMOUNT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return USD.format(value);
}

export function formatAmount(value: number): string {
  return AMOUNT.format(value);
}
