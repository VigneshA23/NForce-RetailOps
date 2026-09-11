// Case-insensitive substring match against any of several fields -- the
// shared shape for "search across every visible column" boxes, matching the
// .some()-over-fields convention already used in Employees.tsx/AssignEmployeeModal.tsx.
export function matchesSearch(query: string, fields: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => (field ?? '').toLowerCase().includes(q));
}
