import type { Notification } from '../types/notification';
import type { StoreSummary } from '../types/store';

export const STORE_NOT_SPECIFIED = 'Store not specified';

const ACCOUNT_LEVEL_CATEGORIES = new Set([
  'EMPLOYEE_ACCOUNT_DEACTIVATED',
  'EMPLOYEE_ACCOUNT_REACTIVATED',
  'ACCOUNT_DEACTIVATED',
  'ACCOUNT_REACTIVATED',
]);

export type NotificationStoreAssociation =
  | { kind: 'assigned'; storeId: number; storeName: string }
  | { kind: 'unspecified'; storeName: string }
  | { kind: 'unassigned' };

function findStoreByName(name: string | null | undefined, stores: StoreSummary[]): StoreSummary | undefined {
  const normalizedName = name?.trim().toLocaleLowerCase();
  if (!normalizedName) return undefined;
  return stores.find((store) => store.name.trim().toLocaleLowerCase() === normalizedName);
}

export function resolveNotificationStore(
  notification: Notification,
  assignedStores: StoreSummary[],
): NotificationStoreAssociation {
  if (notification.storeId != null) {
    const store = assignedStores.find((candidate) => candidate.id === notification.storeId);
    return store
      ? { kind: 'assigned', storeId: store.id, storeName: store.name }
      : { kind: 'unassigned' };
  }

  const relatedStore = findStoreByName(notification.relatedStoreName, assignedStores);
  return { kind: 'unspecified', storeName: relatedStore?.name ?? STORE_NOT_SPECIFIED };
}

export function isNotificationVisibleForStore(
  notification: Notification,
  assignedStores: StoreSummary[],
  selectedStoreId: number | 'all',
): boolean {
  // Null/missing store IDs are explicitly included for every employee store
  // view; an explicit ID must be in the employee's assigned-store list.
  if (notification.storeId == null) return true;
  if (!assignedStores.some((store) => store.id === notification.storeId)) return false;
  return selectedStoreId === 'all' || notification.storeId === selectedStoreId;
}

export function formatNotificationMessage(notification: Notification, assignedStores?: StoreSummary[]): string {
  const { beforeStoreName, storeName, afterStoreName } = getNotificationMessageParts(notification, assignedStores);
  return `${beforeStoreName}${storeName ?? ''}${afterStoreName}`;
}

export interface NotificationMessageParts {
  beforeStoreName: string;
  storeName: string | null;
  afterStoreName: string;
}

export function getNotificationMessageParts(
  notification: Notification,
  assignedStores?: StoreSummary[],
): NotificationMessageParts {
  const message = notification.message?.trim() ?? '';
  // Account-level notices are sent once per user, not per store, so they never
  // carry a store prefix (and must not fall back to "Store not specified").
  if (ACCOUNT_LEVEL_CATEGORIES.has(notification.category)) {
    return { beforeStoreName: message, storeName: null, afterStoreName: '' };
  }
  let storeName: string | null = null;
  if (assignedStores) {
    const association = resolveNotificationStore(notification, assignedStores);
    storeName = association.kind === 'unassigned' ? STORE_NOT_SPECIFIED : association.storeName;
  } else {
    storeName = notification.relatedStoreName?.trim() || null;
  }

  if (!storeName) {
    return { beforeStoreName: message, storeName: null, afterStoreName: '' };
  }

  const storeNameIndex = message.toLocaleLowerCase().indexOf(storeName.toLocaleLowerCase());
  if (storeNameIndex >= 0) {
    return {
      beforeStoreName: message.slice(0, storeNameIndex),
      storeName: message.slice(storeNameIndex, storeNameIndex + storeName.length),
      afterStoreName: message.slice(storeNameIndex + storeName.length),
    };
  }

  return {
    beforeStoreName: '',
    storeName,
    afterStoreName: message ? ` · ${message}` : '',
  };
}
