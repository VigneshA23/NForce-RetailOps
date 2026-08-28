import type { LucideIcon } from 'lucide-react';

export type NavTabKey = 'home' | 'store-management' | 'employees' | 'categories' | 'tasks' | 'history';

export interface NavItem {
  key: NavTabKey;
  label: string;
  icon: LucideIcon;
}

export type EmployeeNavTabKey = 'today' | 'history' | 'audits' | 'settings' | 'support';

export interface EmployeeNavItem {
  key: EmployeeNavTabKey;
  label: string;
  icon: LucideIcon;
}
