import type { LucideIcon } from 'lucide-react';
import { Clock, LayoutGrid, Settings, Store, Tags, Users } from 'lucide-react';

export type NavTabKey =
  | 'home'
  | 'store-management'
  | 'employees'
  | 'categories'
  | 'history'
  | 'settings';

export interface NavItem {
  key: NavTabKey;
  label: string;
  icon: LucideIcon;
}

export const OWNER_NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: LayoutGrid },
  { key: 'store-management', label: 'Stores', icon: Store },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'history', label: 'History', icon: Clock },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export const PAGE_TITLES: Record<NavTabKey, string> = {
  home: 'Home',
  'store-management': 'Stores',
  employees: 'Employees',
  categories: 'Categories',
  history: 'History',
  settings: 'Settings',
};

export type EmployeeNavTabKey = 'today' | 'history' | 'audits' | 'settings' | 'support';

export interface EmployeeNavItem {
  key: EmployeeNavTabKey;
  label: string;
  icon: LucideIcon;
}
