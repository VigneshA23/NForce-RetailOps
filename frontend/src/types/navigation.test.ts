import { describe, expect, it } from 'vitest';
import {
  OWNER_BOTTOM_NAV_ITEMS,
  OWNER_NAV_ITEMS,
  PAGE_TITLES,
  SUPER_ADMIN_BOTTOM_NAV_ITEMS,
  SUPER_ADMIN_NAV_ITEMS,
  SUPER_ADMIN_PAGE_TITLES,
  type NavTabKey,
  type SuperAdminNavTabKey,
} from './navigation';

// A tab a shell can render but nothing navigates to is invisible to the user.
// The owner's Orders and Inventory tabs sat in that state until 1f8e046, and
// the Super Admin's Inventory tab outlived that fix in the same state. Both
// were renderable, reachable only by hand-editing localStorage.
//
// The PAGE_TITLES maps are typed Record<Key, string>, so TypeScript already
// forces them to name every tab key. That makes their keys a reliable runtime
// list of "every tab a shell can render" to check reachability against.
//
// A key with no sidebar entry must be listed below with its actual route, so
// that dropping a nav entry fails here rather than silently stranding a page.
const OWNER_KEYS_REACHED_WITHOUT_A_NAV_ENTRY: NavTabKey[] = [
  // Profile menu, plus the Home page's Active Issues tile -- see DashboardShell.
  'issues',
];
const SUPER_ADMIN_KEYS_REACHED_WITHOUT_A_NAV_ENTRY: SuperAdminNavTabKey[] = [];

const ownerNavKeys = OWNER_NAV_ITEMS.map((item) => item.key);
const superAdminNavKeys = SUPER_ADMIN_NAV_ITEMS.map((item) => item.key);

describe('owner navigation', () => {
  it.each(Object.keys(PAGE_TITLES) as NavTabKey[])(
    'tab %s is reachable from the sidebar or a recorded alternative route',
    (key) => {
      const reachable =
        ownerNavKeys.includes(key) || OWNER_KEYS_REACHED_WITHOUT_A_NAV_ENTRY.includes(key);
      expect(reachable).toBe(true);
    },
  );

  it('keeps the mobile bottom bar a subset of the sidebar', () => {
    // OWNER_BOTTOM_NAV_ITEMS is built with a non-null-asserted .find(), so a
    // renamed key would yield undefined entries rather than failing outright.
    expect(OWNER_BOTTOM_NAV_ITEMS.every((item) => item != null)).toBe(true);
    for (const item of OWNER_BOTTOM_NAV_ITEMS) {
      expect(ownerNavKeys).toContain(item.key);
    }
  });

  it('keeps Inventory and Orders off the bottom bar', () => {
    // Five entries already give ~60px of label width at 375px; adding these
    // two is what the profile-menu entries in DashboardShell exist to avoid.
    const bottomKeys = OWNER_BOTTOM_NAV_ITEMS.map((item) => item.key);
    expect(bottomKeys).not.toContain('inventory');
    expect(bottomKeys).not.toContain('orders');
    expect(bottomKeys).toHaveLength(5);
  });
});

describe('super admin navigation', () => {
  it.each(Object.keys(SUPER_ADMIN_PAGE_TITLES) as SuperAdminNavTabKey[])(
    'tab %s is reachable from the sidebar or a recorded alternative route',
    (key) => {
      const reachable =
        superAdminNavKeys.includes(key) ||
        SUPER_ADMIN_KEYS_REACHED_WITHOUT_A_NAV_ENTRY.includes(key);
      expect(reachable).toBe(true);
    },
  );

  it('has a sidebar entry for the inventory catalogue', () => {
    // Regression pin: this entry was missing while SuperAdminDashboard could
    // already render the page, so the catalogue could not be opened at all.
    expect(superAdminNavKeys).toContain('inventory');
  });

  it('keeps the mobile bottom bar a subset of the sidebar', () => {
    expect(SUPER_ADMIN_BOTTOM_NAV_ITEMS.every((item) => item != null)).toBe(true);
    for (const item of SUPER_ADMIN_BOTTOM_NAV_ITEMS) {
      expect(superAdminNavKeys).toContain(item.key);
    }
  });
});
