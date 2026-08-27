import type { LucideIcon } from 'lucide-react';

export type NavTabKey = 'home' | 'store-management' | 'employees' | 'categories' | 'history';

export interface NavItem {
  key: NavTabKey;
  label: string;
  icon: LucideIcon;
}
