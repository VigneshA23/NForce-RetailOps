export interface ActivityLogEntry {
  id: number;
  actionType: string;
  actorName: string;
  // 'OWNER_ADMIN' | 'SUPER_ADMIN' | 'EMPLOYEE'
  actorRole: string;
  // Null for a platform-level event with no single store (e.g. an admin
  // account created before any store is assigned).
  storeName: string | null;
  entityType: string | null;
  entityName: string | null;
  description: string;
  occurredAt: string;
}
