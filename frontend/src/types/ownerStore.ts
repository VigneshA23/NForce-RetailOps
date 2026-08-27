export interface OwnerStore {
  id: number;
  name: string;
  active: boolean;
  employeeCount: number;
  taskCount: number;
}

export type OwnerStoreFormValues = { name: string };
