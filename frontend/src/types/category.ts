export interface Category {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  taskCount: number;
}

export type CategoryFormValues = Pick<Category, 'name'>;
