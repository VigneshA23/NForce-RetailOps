// Two-letter initials for the Profile page avatar (first + last name initial).
// Distinct from the single-letter initials Sidebar/ProfileMenu use for their
// smaller avatars -- both are intentional, not an inconsistency to fix here.
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
