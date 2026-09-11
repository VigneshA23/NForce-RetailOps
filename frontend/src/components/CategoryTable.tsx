import { Pencil, Trash2 } from 'lucide-react';
import type { Category } from '../types/category';
import Toggle from './Toggle';
import './CategoryTable.css';

interface CategoryTableProps {
  categories: Category[];
  canManage: boolean;
  isLoading?: boolean;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onToggleStatus?: (category: Category, active: boolean) => void;
}

function storesLabel(category: Category): string {
  if (category.appliesToAllStores) return 'All Stores';
  if (category.stores.length === 0) return '—';
  return category.stores.map((store) => store.name).join(', ');
}

function CategoryTable({
  categories,
  canManage,
  isLoading = false,
  onEdit,
  onDelete,
  onToggleStatus,
}: CategoryTableProps) {
  return (
    <div className="category-table__card table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Category Name</th>
              <th scope="col">Stores</th>
              <th scope="col">Tasks</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col" className="task-table__actions-header">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="category-table__row">
                <td className="category-table__name" data-label="Category Name">{category.name}</td>
                <td className="category-table__stores" data-label="Stores">{storesLabel(category)}</td>
                <td className="category-table__task-count" data-label="Tasks">{category.taskCount}</td>
                <td data-label="Status">
                  {canManage && onToggleStatus ? (
                    <Toggle
                      checked={category.active}
                      onChange={(checked) => onToggleStatus(category, checked)}
                      label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                    />
                  ) : (
                    <span className={`category-table__status-badge ${category.active ? 'is-active' : 'is-inactive'}`}>
                      {category.active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="table-actions-cell" data-label="Actions">
                    <div className="table-row-actions">
                      <button
                        type="button"
                        className="table-icon-btn"
                        aria-label={`Edit ${category.name}`}
                        title="Edit"
                        onClick={() => onEdit?.(category)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn--danger"
                        aria-label={`Delete ${category.name}`}
                        title="Delete"
                        onClick={() => onDelete?.(category)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
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
