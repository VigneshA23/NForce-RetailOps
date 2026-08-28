export interface CountryCodeOption {
  code: string;
  label: string;
}

export const COUNTRY_CODE_OPTIONS: CountryCodeOption[] = [
  { code: '+1', label: 'USA/Canada (+1)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+65', label: 'Singapore (+65)' },
];

export function parsePhoneForForm(rawPhone: string): { countryCode: string; phone: string } {
  const defaultCode = COUNTRY_CODE_OPTIONS[0].code;
  const trimmed = rawPhone.trim();

  if (trimmed.startsWith('+')) {
    const match = COUNTRY_CODE_OPTIONS.find((option) => trimmed.startsWith(option.code));
    if (match) {
      const digits = trimmed.slice(match.code.length).replace(/\D/g, '');
      return { countryCode: match.code, phone: digits.slice(-10) };
    }
  }

  const digits = trimmed.replace(/\D/g, '');
  return { countryCode: defaultCode, phone: digits.slice(-10) };
}
