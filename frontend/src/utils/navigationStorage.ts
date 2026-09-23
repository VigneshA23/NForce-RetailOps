import type { EmployeeNavTabKey, NavTabKey, SuperAdminNavTabKey } from '../types/navigation';

// There is no router in this app (see CLAUDE.md) -- each shell's "active tab"
// is plain in-memory React state, so a hard refresh used to always remount at
// the shell's hardcoded default tab instead of staying where the user was.
// Persisting the tab key here, keyed per role so the three shells never
// collide, fixes that the same way activeStoreId already survives refresh
// for employees (see authStorage.ts).

// Keep these lists in sync with the corresponding type union in
// types/navigation.ts -- a stored value outside this list is treated as
// invalid and ignored, so a stale/renamed tab key can never crash a shell.
const SUPER_ADMIN_TAB_VALUES: readonly SuperAdminNavTabKey[] = [
  'home', 'owners', 'stores', 'employees', 'categories', 'tasks', 'checklist', 'issues', 'inventory',
];
const OWNER_TAB_VALUES: readonly NavTabKey[] = [
  'home', 'store-detail', 'employees', 'categories', 'tasks', 'issues', 'inventory', 'orders',
];
const EMPLOYEE_TAB_VALUES: readonly EmployeeNavTabKey[] = ['today', 'audits', 'issues', 'missing', 'stock-check'];

function readTab<T extends string>(key: string, validValues: readonly T[]): T | null {
  const raw = localStorage.getItem(key);
  return raw !== null && (validValues as readonly string[]).includes(raw) ? (raw as T) : null;
}

const SUPER_ADMIN_TAB_STORAGE_KEY = 'nforce-retailops-super-admin-tab';

export function setSuperAdminTab(tab: SuperAdminNavTabKey): void {
  localStorage.setItem(SUPER_ADMIN_TAB_STORAGE_KEY, tab);
}

export function getSuperAdminTab(): SuperAdminNavTabKey | null {
  return readTab(SUPER_ADMIN_TAB_STORAGE_KEY, SUPER_ADMIN_TAB_VALUES);
}

export function clearSuperAdminTab(): void {
  localStorage.removeItem(SUPER_ADMIN_TAB_STORAGE_KEY);
}

const OWNER_TAB_STORAGE_KEY = 'nforce-retailops-owner-tab';

export function setOwnerTab(tab: NavTabKey): void {
  localStorage.setItem(OWNER_TAB_STORAGE_KEY, tab);
}

export function getOwnerTab(): NavTabKey | null {
  return readTab(OWNER_TAB_STORAGE_KEY, OWNER_TAB_VALUES);
}

export function clearOwnerTab(): void {
  localStorage.removeItem(OWNER_TAB_STORAGE_KEY);
}

const EMPLOYEE_TAB_STORAGE_KEY = 'nforce-retailops-employee-tab';

export function setEmployeeTab(tab: EmployeeNavTabKey): void {
  localStorage.setItem(EMPLOYEE_TAB_STORAGE_KEY, tab);
}

export function getEmployeeTab(): EmployeeNavTabKey | null {
  return readTab(EMPLOYEE_TAB_STORAGE_KEY, EMPLOYEE_TAB_VALUES);
}

export function clearEmployeeTab(): void {
  localStorage.removeItem(EMPLOYEE_TAB_STORAGE_KEY);
}

// Recent Activity, Notifications, Profile and Help are reached as overlays on
// top of a tab (not tabs themselves), tracked as separate booleans/an
// `Overlay` union rather than being part of activeTab -- so persisting the
// tab alone (above) wasn't enough: refreshing while one of these was open
// still dropped back to whatever tab was underneath. Persist the open
// overlay the same way, per role.
export type SuperAdminOverlayKey = 'profile' | 'help' | 'notifications' | 'activity';
export type OwnerOverlayKey = 'profile' | 'help' | 'notifications';
export type EmployeeOverlayKey = 'profile' | 'help' | 'notifications';

const SUPER_ADMIN_OVERLAY_VALUES: readonly SuperAdminOverlayKey[] = ['profile', 'help', 'notifications', 'activity'];
const OWNER_OVERLAY_VALUES: readonly OwnerOverlayKey[] = ['profile', 'help', 'notifications'];
const EMPLOYEE_OVERLAY_VALUES: readonly EmployeeOverlayKey[] = ['profile', 'help', 'notifications'];

function readOverlay<T extends string>(key: string, validValues: readonly T[]): T | null {
  const raw = localStorage.getItem(key);
  return raw !== null && (validValues as readonly string[]).includes(raw) ? (raw as T) : null;
}

function writeOverlay(key: string, overlay: string | null): void {
  if (overlay === null) localStorage.removeItem(key);
  else localStorage.setItem(key, overlay);
}

const SUPER_ADMIN_OVERLAY_STORAGE_KEY = 'nforce-retailops-super-admin-overlay';

export function setSuperAdminOverlay(overlay: SuperAdminOverlayKey | null): void {
  writeOverlay(SUPER_ADMIN_OVERLAY_STORAGE_KEY, overlay);
}

export function getSuperAdminOverlay(): SuperAdminOverlayKey | null {
  return readOverlay(SUPER_ADMIN_OVERLAY_STORAGE_KEY, SUPER_ADMIN_OVERLAY_VALUES);
}

export function clearSuperAdminOverlay(): void {
  localStorage.removeItem(SUPER_ADMIN_OVERLAY_STORAGE_KEY);
}

const OWNER_OVERLAY_STORAGE_KEY = 'nforce-retailops-owner-overlay';

export function setOwnerOverlay(overlay: OwnerOverlayKey | null): void {
  writeOverlay(OWNER_OVERLAY_STORAGE_KEY, overlay);
}

export function getOwnerOverlay(): OwnerOverlayKey | null {
  return readOverlay(OWNER_OVERLAY_STORAGE_KEY, OWNER_OVERLAY_VALUES);
}

export function clearOwnerOverlay(): void {
  localStorage.removeItem(OWNER_OVERLAY_STORAGE_KEY);
}

const EMPLOYEE_OVERLAY_STORAGE_KEY = 'nforce-retailops-employee-overlay';

export function setEmployeeOverlay(overlay: EmployeeOverlayKey | null): void {
  writeOverlay(EMPLOYEE_OVERLAY_STORAGE_KEY, overlay);
}

export function getEmployeeOverlay(): EmployeeOverlayKey | null {
  return readOverlay(EMPLOYEE_OVERLAY_STORAGE_KEY, EMPLOYEE_OVERLAY_VALUES);
}

export function clearEmployeeOverlay(): void {
  localStorage.removeItem(EMPLOYEE_OVERLAY_STORAGE_KEY);
}
