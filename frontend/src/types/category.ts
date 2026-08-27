export interface Category {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
}

export type CategoryFormValues = Pick<Category, 'name'>;
