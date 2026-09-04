import type { Employee } from './employee';

export interface SuperAdminEmployee extends Employee {
  ownerId: number | null;
  ownerName: string;
}
