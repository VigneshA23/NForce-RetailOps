import type { EmployeeNavTabKey, NavTabKey, SuperAdminNavTabKey } from '../types/navigation';

// There is no router (see CLAUDE.md), so a notification's backend-supplied
// `linkPath` is translated into a shell tab here. One map per role, in one
// place, instead of three hand-written switch statements that drifted apart
// (e.g. Super Admin had no '/issues' case at all). A path missing from its
// role's map falls back to the Notifications overlay.
//
// Keep in sync with the linkPath values the backend emits (NotificationService,
// SuperAdminAlertService, EmployeeService, CategoryService, TaskService) --
// notificationRoutes.test.ts pins that list per recipient role.

// Extra context from the clicked notification, for destinations that can
// use it (History seeds its date; Issues scrolls to the related issue).
export interface NotificationNavContext {
  createdAt?: string;
  relatedIssueId?: number | null;
}

export type NotificationNavigateHandler = (path: string, context?: NotificationNavContext) => void;

export type OwnerNotificationTarget = NavTabKey | 'profile';
export type EmployeeNotificationTarget = EmployeeNavTabKey;
export type SuperAdminNotificationTarget = SuperAdminNavTabKey;

export const OWNER_NOTIFICATION_ROUTES: Record<string, OwnerNotificationTarget> = {
  '/home': 'home',
  '/store-detail': 'store-detail',
  '/employees': 'employees',
  '/tasks': 'tasks',
  '/issues': 'issues',
  '/profile': 'profile',
};

export const EMPLOYEE_NOTIFICATION_ROUTES: Record<string, EmployeeNotificationTarget> = {
  '/checklist': 'today',
  '/audit': 'audits',
  '/issues': 'issues',
};

export const SUPER_ADMIN_NOTIFICATION_ROUTES: Record<string, SuperAdminNotificationTarget> = {
  '/checklist': 'checklist',
  '/owners': 'owners',
  '/issues': 'issues',
};

// Ignores any query string/hash so a future '/issues?storeId=3' still
// resolves to the Issues tab.
export function resolveNotificationRoute<T>(routes: Record<string, T>, path: string): T | null {
  const bare = path.split(/[?#]/)[0];
  return Object.prototype.hasOwnProperty.call(routes, bare) ? routes[bare] : null;
}
