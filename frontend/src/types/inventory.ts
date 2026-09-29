export interface InventoryCategory {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  itemCount: number;
}

export interface InventoryCategoryFormValues {
  name: string;
}
