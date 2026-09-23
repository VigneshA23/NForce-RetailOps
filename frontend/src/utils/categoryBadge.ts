// Badge colors a Super Admin can pick for a category (Add/Edit Category form).
// The value is stored on the category and drives its icon tile color; keep in
// sync with CategoryRequest's @Pattern on the backend.
export type CategoryBadgeColor = 'red' | 'green' | 'amber' | 'blue' | 'purple' | 'slate';

export const CATEGORY_BADGE_COLORS: { value: CategoryBadgeColor; label: string }[] = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'slate', label: 'Slate' },
];

export const DEFAULT_CATEGORY_BADGE_COLOR: CategoryBadgeColor = 'red';
