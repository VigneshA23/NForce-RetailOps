import type { LucideIcon } from 'lucide-react';

<<<<<<< Updated upstream
export type NavTabKey = 'home' | 'store-management' | 'employees' | 'categories' | 'history';
=======
export type NavTabKey = 'dashboard' | 'employees' | 'profile' | 'help';
>>>>>>> Stashed changes

export interface NavItem {
  key: NavTabKey;
  label: string;
  icon: LucideIcon;
}
