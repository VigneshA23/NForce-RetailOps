import {
  AlarmClock,
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileWarning,
  ListPlus,
  MailX,
  Megaphone,
  PenLine,
  Store,
  TriangleAlert,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from 'lucide-react';

// Single source of truth for how every notification category is displayed,
// shared by NotificationBell (dropdown) and the full Notifications page so
// the two surfaces can't drift out of sync with each other or with the
// backend's category list (NotificationService.PRIORITY_BY_CATEGORY).

export type DisplayCategory =
  | 'Store Issues'
  | 'Checklist Updates'
  | 'Store Management'
  | 'Account & Access'
  | 'Employee Management'
  | 'Platform Alerts';

export interface CategoryMeta {
  icon: LucideIcon;
  bgVar: string;
  fgVar: string;
  displayCategory: DisplayCategory;
}

const WARNING = { bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
const SUCCESS = { bgVar: '--color-badge-icon-success-bg', fgVar: '--color-badge-icon-success-fg' };
const INFO = { bgVar: '--color-badge-icon-info-bg', fgVar: '--color-badge-icon-info-fg' };
const PRIMARY = { bgVar: '--color-badge-icon-primary-bg', fgVar: '--color-badge-icon-primary-fg' };

export const CATEGORY_META: Record<string, CategoryMeta> = {
  ISSUE_RAISED: { icon: AlertCircle, ...PRIMARY, displayCategory: 'Store Issues' },
  ISSUE_ACKNOWLEDGED: { icon: Clock, ...WARNING, displayCategory: 'Store Issues' },
  ISSUE_RESOLVED: { icon: CheckCircle2, ...SUCCESS, displayCategory: 'Store Issues' },
  ISSUE_NUDGE: { icon: Megaphone, ...WARNING, displayCategory: 'Store Issues' },

  CORRECTION_MADE: { icon: PenLine, ...INFO, displayCategory: 'Checklist Updates' },
  RESPONSE_NEEDS_ATTENTION: { icon: FileWarning, ...WARNING, displayCategory: 'Checklist Updates' },
  TASK_ADDED: { icon: ClipboardList, ...INFO, displayCategory: 'Checklist Updates' },
  TASK_MAKEUP_FULFILLED: { icon: ClipboardCheck, ...SUCCESS, displayCategory: 'Checklist Updates' },
  CATEGORY_ADDED: { icon: ListPlus, ...INFO, displayCategory: 'Checklist Updates' },

  STORE_DEACTIVATED: { icon: Store, ...WARNING, displayCategory: 'Store Management' },
  STORE_REACTIVATED: { icon: Store, ...SUCCESS, displayCategory: 'Store Management' },

  ACCOUNT_DEACTIVATED: { icon: UserX, ...WARNING, displayCategory: 'Account & Access' },
  ACCOUNT_REACTIVATED: { icon: UserCheck, ...SUCCESS, displayCategory: 'Account & Access' },
  EMPLOYEE_ACCOUNT_DEACTIVATED: { icon: UserX, ...WARNING, displayCategory: 'Account & Access' },
  EMPLOYEE_ACCOUNT_REACTIVATED: { icon: UserCheck, ...SUCCESS, displayCategory: 'Account & Access' },

  EMPLOYEE_ASSIGNED: { icon: UserPlus, ...SUCCESS, displayCategory: 'Employee Management' },
  NEW_EMPLOYEE_JOINED: { icon: UserPlus, ...SUCCESS, displayCategory: 'Employee Management' },
  EMPLOYEE_REMOVED: { icon: UserMinus, ...WARNING, displayCategory: 'Employee Management' },

  STORE_ZERO_ACTIVITY: { icon: TriangleAlert, ...WARNING, displayCategory: 'Platform Alerts' },
  ISSUES_OVERDUE: { icon: AlarmClock, ...WARNING, displayCategory: 'Platform Alerts' },
  OWNER_EMAIL_FAILED: { icon: MailX, ...WARNING, displayCategory: 'Platform Alerts' },
  STORE_OWNER_VACANT: { icon: Building2, ...WARNING, displayCategory: 'Platform Alerts' },
};

export const DEFAULT_CATEGORY_META: CategoryMeta = {
  icon: Bell,
  ...INFO,
  displayCategory: 'Store Issues',
};

export function getCategoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? DEFAULT_CATEGORY_META;
}

export const ALL_DISPLAY_CATEGORIES: DisplayCategory[] = [
  'Store Issues',
  'Checklist Updates',
  'Store Management',
  'Account & Access',
  'Employee Management',
  'Platform Alerts',
];
