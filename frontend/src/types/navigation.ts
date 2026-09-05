import type { LucideIcon } from 'lucide-react';
import { Building2, CheckSquare, ClipboardList, LayoutGrid, Store, Tags, Users } from 'lucide-react';

export type NavTabKey =
  | 'home'
  | 'store-detail'
  | 'employees'
  | 'categories'
  | 'tasks';

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
];

// Mobile bottom tab bar for the Owner/Admin shell: a subset of OWNER_NAV_ITEMS
// (no History/Settings) so the floating pill stays legible at phone width.
const OWNER_BOTTOM_NAV_ORDER: NavTabKey[] = ['home', 'employees', 'categories', 'tasks', 'store-detail'];
export const OWNER_BOTTOM_NAV_ITEMS: NavItem[] = OWNER_BOTTOM_NAV_ORDER.map(
  (key) => OWNER_NAV_ITEMS.find((item) => item.key === key)!,
);

export const PAGE_TITLES: Record<NavTabKey, string> = {
  home: 'Home',
  'store-detail': 'Store Detail',
  employees: 'Employees',
  categories: 'Categories',
  tasks: 'Tasks',
};

export type EmployeeNavTabKey = 'today' | 'audits';

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
