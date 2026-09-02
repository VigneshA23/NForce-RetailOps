export interface OwnerStore {
  id: number;
  storeCode: number;
  name: string;
  active: boolean;
  employeeCount: number;
  taskCount: number;
}

export type OwnerStoreFormValues = { name: string };
