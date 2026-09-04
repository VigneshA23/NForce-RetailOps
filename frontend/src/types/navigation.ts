import type { LucideIcon } from 'lucide-react';
import { Building2, CheckSquare, ClipboardList, Clock, LayoutGrid, Settings, Store, Tags, Users } from 'lucide-react';

export type NavTabKey =
  | 'home'
  | 'store-detail'
  | 'employees'
  | 'categories'
  | 'tasks'
  | 'history'
  | 'settings';

export interface NavItem<Key extends string = NavTabKey> {
  key: Key;
  label: string;
  icon: LucideIcon;
}

export const OWNER_NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: LayoutGrid },
  { key: 'store-detail', label: 'Store Detail', icon: ClipboardList },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'history', label: 'History', icon: Clock },
  { key: 'settings', label: 'Settings', icon: Settings },
];

// Mobile bottom tab bar for the Owner/Admin shell: a deliberately narrower
// subset of OWNER_NAV_ITEMS (no Home/History/Settings) so the fixed-width
// bar stays legible at phone width. Order is Employees, Categories, Tasks,
// Store Detail -- not OWNER_NAV_ITEMS' own order -- to match the requested
// tab hierarchy.
const OWNER_BOTTOM_NAV_ORDER: NavTabKey[] = ['employees', 'categories', 'tasks', 'store-detail'];
export const OWNER_BOTTOM_NAV_ITEMS: NavItem[] = OWNER_BOTTOM_NAV_ORDER.map(
  (key) => OWNER_NAV_ITEMS.find((item) => item.key === key)!,
);

export const PAGE_TITLES: Record<NavTabKey, string> = {
  home: 'Home',
  'store-detail': 'Store Detail',
  employees: 'Employees',
  categories: 'Categories',
  tasks: 'Tasks',
  history: 'History',
  settings: 'Settings',
};

export type EmployeeNavTabKey = 'today' | 'history';

export interface EmployeeNavItem {
  key: EmployeeNavTabKey;
  label: string;
  icon: LucideIcon;
}

export type SuperAdminNavTabKey = 'owners' | 'stores' | 'employees';

export const SUPER_ADMIN_NAV_ITEMS: NavItem<SuperAdminNavTabKey>[] = [
  { key: 'owners', label: 'Owners', icon: Building2 },
  { key: 'stores', label: 'Stores', icon: Store },
  { key: 'employees', label: 'Employees', icon: Users },
];

export const SUPER_ADMIN_PAGE_TITLES: Record<SuperAdminNavTabKey, string> = {
  owners: 'Owners',
  stores: 'Stores',
  employees: 'Employees',
};
