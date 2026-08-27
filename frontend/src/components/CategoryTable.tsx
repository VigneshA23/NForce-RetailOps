import { Pencil } from 'lucide-react';
import type { Category } from '../types/category';
import IconButton from './IconButton';
import './CategoryTable.css';

interface CategoryTableProps {
  categories: Category[];
  isLoading?: boolean;
  onEdit: (category: Category) => void;
}

function CategoryTable({ categories, isLoading = false, onEdit }: CategoryTableProps) {
  return (
    <div className="category-table__card">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Category Name</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td className="category-table__name">{category.name}</td>
              <td>
                <span className={`badge ${category.active ? 'badge--solid' : 'badge--outline'}`}>
                  {category.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="category-table__actions-cell">
                <IconButton icon={Pencil} ariaLabel={`Edit ${category.name}`} onClick={() => onEdit(category)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isLoading && categories.length === 0 && (
        <div className="category-table__empty">No categories yet. Add one to get started.</div>
      )}
      {isLoading && <div className="category-table__empty">Loading categories...</div>}
    </div>
  );
}

export default CategoryTable;
