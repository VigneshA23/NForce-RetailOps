import type { LucideIcon } from 'lucide-react';
import { Building2, CheckSquare, Clock, LayoutGrid, Settings, Store, Tags, Users } from 'lucide-react';

export type NavTabKey =
  | 'home'
  | 'store-management'
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
  { key: 'store-management', label: 'Stores', icon: Store },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'history', label: 'History', icon: Clock },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export const PAGE_TITLES: Record<NavTabKey, string> = {
  home: 'Home',
  'store-management': 'Stores',
  employees: 'Employees',
  categories: 'Categories',
  tasks: 'Tasks',
  history: 'History',
  settings: 'Settings',
};

export type EmployeeNavTabKey = 'today' | 'history' | 'audits' | 'settings' | 'support';

export interface EmployeeNavItem {
  key: EmployeeNavTabKey;
  label: string;
  icon: LucideIcon;
}

export type SuperAdminNavTabKey = 'owners';

export const SUPER_ADMIN_NAV_ITEMS: NavItem<SuperAdminNavTabKey>[] = [
  { key: 'owners', label: 'Owners', icon: Building2 },
];

export const SUPER_ADMIN_PAGE_TITLES: Record<SuperAdminNavTabKey, string> = {
  owners: 'Owners',
};
