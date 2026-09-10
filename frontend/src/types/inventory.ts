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

export interface InventoryItem {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  unitOfMeasurement: string;
  active: boolean;
}

export interface InventoryItemFormValues {
  categoryId: number | null;
  name: string;
  unitOfMeasurement: string;
}
