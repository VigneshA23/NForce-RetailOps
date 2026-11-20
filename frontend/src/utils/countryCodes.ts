export interface CountryCodeOption {
  code: string;
  label: string;
  /** National number length, without the country code or a trunk "0". */
  digits: number;
  /** Optional extra rule on the national number (e.g. India mobiles start 6-9). */
  pattern?: RegExp;
  patternMessage?: string;
}

export const COUNTRY_CODE_OPTIONS: CountryCodeOption[] = [
  { code: '+1', label: 'USA/Canada (+1)', digits: 10 },
  {
    code: '+91',
    label: 'India (+91)',
    digits: 10,
    pattern: /^[6-9]/,
    patternMessage: 'Indian mobile numbers start with 6, 7, 8 or 9',
  },
  { code: '+44', label: 'UK (+44)', digits: 10 },
  { code: '+971', label: 'UAE (+971)', digits: 9 },
  { code: '+61', label: 'Australia (+61)', digits: 9 },
  { code: '+65', label: 'Singapore (+65)', digits: 8 },
];

export function phoneDigitsFor(countryCode: string): number {
  return COUNTRY_CODE_OPTIONS.find((option) => option.code === countryCode)?.digits ?? 10;
}

/** Returns an error message, or null when `digits` is a valid number for the country. */
export function validatePhoneNumber(countryCode: string, digits: string): string | null {
  const option = COUNTRY_CODE_OPTIONS.find((o) => o.code === countryCode);
  const expected = option?.digits ?? 10;
  if (!/^\d+$/.test(digits) || digits.length !== expected) {
    return `Contact number must be exactly ${expected} digits for ${option?.label ?? countryCode}`;
  }
  if (option?.pattern && !option.pattern.test(digits)) {
    return option.patternMessage ?? 'Enter a valid contact number';
  }
  return null;
}

export function parsePhoneForForm(rawPhone: string): { countryCode: string; phone: string } {
  const defaultCode = COUNTRY_CODE_OPTIONS[0].code;
  const trimmed = rawPhone.trim();

  if (trimmed.startsWith('+')) {
    const match = COUNTRY_CODE_OPTIONS.find((option) => trimmed.startsWith(option.code));
    if (match) {
      const digits = trimmed.slice(match.code.length).replace(/\D/g, '');
      return { countryCode: match.code, phone: digits.slice(-match.digits) };
    }
  }

  const digits = trimmed.replace(/\D/g, '');
  return { countryCode: defaultCode, phone: digits.slice(-10) };
}
