import type { LucideIcon } from 'lucide-react';

export type NavTabKey = 'home' | 'store-management' | 'employees' | 'history';

export interface NavItem {
  key: NavTabKey;
  label: string;
  icon: LucideIcon;
}
