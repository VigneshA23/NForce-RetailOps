import { apiRequest } from './client';

export interface InventoryUnit {
  id: number;
  name: string;
  wholeNumber: boolean;
}

export async function getInventoryUnits(): Promise<InventoryUnit[]> {
  return apiRequest<InventoryUnit[]>('/inventory-units');
}

// Super Admin only.
export async function createInventoryUnit(name: string, wholeNumber: boolean): Promise<InventoryUnit> {
  return apiRequest<InventoryUnit>('/inventory-units', { method: 'POST', body: { name, wholeNumber } });
}
