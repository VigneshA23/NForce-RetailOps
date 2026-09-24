import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_NOTIFICATION_ROUTES,
  OWNER_NOTIFICATION_ROUTES,
  SUPER_ADMIN_NOTIFICATION_ROUTES,
  resolveNotificationRoute,
} from './notificationRoutes';

// Every linkPath the backend currently emits, grouped by who receives it.
// Adding a new linkPath on the backend without a route here would silently
// dump the user back on the Notifications page -- extend these lists (and the
// route maps) together.
const BACKEND_LINK_PATHS = {
  employee: ['/checklist', '/audit', '/issues'],
  owner: ['/issues', '/home', '/profile', '/employees'],
  superAdmin: ['/checklist', '/owners', '/issues'],
};

describe('notificationRoutes', () => {
  it.each(BACKEND_LINK_PATHS.employee)('employee route %s resolves', (path) => {
    expect(resolveNotificationRoute(EMPLOYEE_NOTIFICATION_ROUTES, path)).not.toBeNull();
  });

  it.each(BACKEND_LINK_PATHS.owner)('owner route %s resolves', (path) => {
    expect(resolveNotificationRoute(OWNER_NOTIFICATION_ROUTES, path)).not.toBeNull();
  });

  it.each(BACKEND_LINK_PATHS.superAdmin)('super admin route %s resolves', (path) => {
    expect(resolveNotificationRoute(SUPER_ADMIN_NOTIFICATION_ROUTES, path)).not.toBeNull();
  });

  it('routes /issues to the Issues tab for every role', () => {
    expect(resolveNotificationRoute(EMPLOYEE_NOTIFICATION_ROUTES, '/issues')).toBe('issues');
    expect(resolveNotificationRoute(OWNER_NOTIFICATION_ROUTES, '/issues')).toBe('issues');
    expect(resolveNotificationRoute(SUPER_ADMIN_NOTIFICATION_ROUTES, '/issues')).toBe('issues');
  });

  it('ignores a query string', () => {
    expect(resolveNotificationRoute(SUPER_ADMIN_NOTIFICATION_ROUTES, '/issues?storeId=3')).toBe('issues');
  });

  it('returns null for an unknown path, including prototype keys', () => {
    expect(resolveNotificationRoute(OWNER_NOTIFICATION_ROUTES, '/nowhere')).toBeNull();
    expect(resolveNotificationRoute(OWNER_NOTIFICATION_ROUTES, 'constructor')).toBeNull();
  });
});
