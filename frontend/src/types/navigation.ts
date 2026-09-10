import type { LucideIcon } from 'lucide-react';
import { Boxes, Building2, CheckSquare, ClipboardList, LayoutGrid, Package, ShoppingCart, Store, Tags, Users, Home } from 'lucide-react';

export type NavTabKey =
  | 'home'
  | 'store-detail'
  | 'employees'
  | 'categories'
  | 'tasks'
  | 'issues'
  | 'inventory'
  | 'orders';

export interface NavItem<Key extends string = NavTabKey> {
  key: Key;
  label: string;
  icon: LucideIcon;
}

export const OWNER_NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: LayoutGrid },
  { key: 'store-detail', label: 'Daily Checklist', icon: ClipboardList },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'orders', label: 'Orders', icon: ShoppingCart },
];

// Mobile bottom tab bar: home, daily checklist, tasks, employees.
// Issues is accessible via the Home page tile and the profile menu.
const OWNER_BOTTOM_NAV_ORDER: NavTabKey[] = ['home', 'store-detail', 'tasks', 'employees'];
export const OWNER_BOTTOM_NAV_ITEMS: NavItem[] = OWNER_BOTTOM_NAV_ORDER.map(
  (key) => OWNER_NAV_ITEMS.find((item) => item.key === key)!,
);

export const PAGE_TITLES: Record<NavTabKey, string> = {
  home: 'Home',
  'store-detail': 'Daily Checklist',
  employees: 'Employees',
  categories: 'Categories',
  tasks: 'Tasks',
  issues: 'Issues',
  inventory: 'Inventory',
  orders: 'Orders',
};

export type EmployeeNavTabKey = 'today' | 'audits' | 'issues' | 'stock-check';

export interface EmployeeNavItem {
  key: EmployeeNavTabKey;
  label: string;
  icon: LucideIcon;
}

export type SuperAdminNavTabKey = 'home' | 'owners' | 'stores' | 'employees' | 'checklist' | 'issues' | 'inventory';

export const SUPER_ADMIN_NAV_ITEMS: NavItem<SuperAdminNavTabKey>[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'owners', label: 'Owners', icon: Building2 },
  { key: 'stores', label: 'Stores', icon: Store },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'checklist', label: 'Daily Checklist', icon: ClipboardList },
  { key: 'inventory', label: 'Inventory', icon: Package },
];

export const SUPER_ADMIN_PAGE_TITLES: Record<SuperAdminNavTabKey, string> = {
  home: 'Home',
  owners: 'Owners',
  stores: 'Stores',
  employees: 'Employees',
  checklist: 'Daily Checklist',
  issues: 'Issues',
  inventory: 'Inventory',
};
