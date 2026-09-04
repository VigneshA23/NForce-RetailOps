// Minimal, dependency-free CSV helpers -- Excel/Google Sheets both parse plain
// RFC 4180-style CSV (comma-separated, double-quote escaping) without a BOM
// or library needed for this app's small owner/admin-facing exports.

// Wrap a field in double quotes (doubling any embedded quotes) whenever it
// contains a comma, quote, or line break -- otherwise leave it bare so simple
// values stay readable in a raw file.
export function toCsvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map(toCsvField).join(',');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
