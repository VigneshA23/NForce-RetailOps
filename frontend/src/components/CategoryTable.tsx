import type { Category } from '../types/category';
import RowActionsMenu from './RowActionsMenu';
import Toggle from './Toggle';
import './CategoryTable.css';

interface CategoryTableProps {
  categories: Category[];
  isLoading?: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onToggleStatus: (category: Category, active: boolean) => void;
}

function CategoryTable({ categories, isLoading = false, onEdit, onDelete, onToggleStatus }: CategoryTableProps) {
  return (
    <div className="category-table__card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Category Name</th>
              <th scope="col">Tasks</th>
              <th scope="col">Status</th>
              <th scope="col" className="category-table__actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="category-table__name">{category.name}</td>
                <td className="category-table__task-count">
                  {category.taskCount} {category.taskCount === 1 ? 'task' : 'tasks'}
                </td>
                <td>
                  <div className="category-table__status">
                    <span className={`badge ${category.active ? 'badge--solid' : 'badge--outline'}`}>
                      {category.active ? 'Active' : 'Inactive'}
                    </span>
                    <Toggle
                      checked={category.active}
                      onChange={(checked) => onToggleStatus(category, checked)}
                      label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                    />
                  </div>
                </td>
                <td className="category-table__actions-cell">
                  <RowActionsMenu onEdit={() => onEdit(category)} onDelete={() => onDelete(category)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && categories.length === 0 && (
        <div className="category-table__empty">No categories match your filters.</div>
      )}
      {isLoading && <div className="category-table__empty">Loading categories...</div>}
    </div>
  );
}

export default CategoryTable;
