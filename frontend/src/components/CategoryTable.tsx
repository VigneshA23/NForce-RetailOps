import { useState } from 'react';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { Category } from '../types/category';
import Toggle from './Toggle';
import './CategoryTable.css';

interface CategoryTableProps {
  categories: Category[];
  isLoading?: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onToggleStatus: (category: Category, active: boolean) => void;
  // Fired on drop with the dragged category's id and the id of the row it was
  // dropped onto -- the page owns turning that into a full reordered list
  // (this table only ever sees the current, possibly filtered, subset).
  onReorder: (draggedId: number, targetId: number) => void;
}

function CategoryTable({
  categories,
  isLoading = false,
  onEdit,
  onDelete,
  onToggleStatus,
  onReorder,
}: CategoryTableProps) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  // Dragging only makes unambiguous sense over the unfiltered, single-page
  // list -- with a search/status filter narrowing what's visible, "drop
  // above this row" would silently reorder against a list the owner can't
  // see the rest of.
  const canReorder = categories.length > 1;

  function endDrag() {
    setDraggedId(null);
    setDragOverId(null);
  }

  return (
    <div className="category-table__card table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {canReorder && <th scope="col" className="category-table__drag-cell" aria-hidden="true" />}
              <th scope="col">Category Name</th>
              <th scope="col">Tasks</th>
              <th scope="col">Status</th>
              <th scope="col" className="task-table__actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr
                key={category.id}
                draggable={canReorder}
                className={`category-table__row${draggedId === category.id ? ' category-table__row--dragging' : ''}${dragOverId === category.id && draggedId !== category.id ? ' category-table__row--drag-over' : ''}`}
                onDragStart={() => setDraggedId(category.id)}
                onDragOver={(event) => {
                  if (draggedId == null || draggedId === category.id) return;
                  event.preventDefault();
                  setDragOverId(category.id);
                }}
                onDragLeave={() => setDragOverId((current) => (current === category.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedId != null && draggedId !== category.id) onReorder(draggedId, category.id);
                  endDrag();
                }}
                onDragEnd={endDrag}
              >
                {canReorder && (
                  <td className="category-table__drag-cell" aria-hidden="true">
                    <GripVertical size={16} />
                  </td>
                )}
                <td className="category-table__name" data-label="Category Name">{category.name}</td>
                <td className="category-table__task-count" data-label="Tasks">{category.taskCount}</td>
                <td data-label="Status">
                  <Toggle
                    checked={category.active}
                    onChange={(checked) => onToggleStatus(category, checked)}
                    label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                  />
                </td>
                <td className="table-actions-cell" data-label="Actions">
                  <div className="table-row-actions">
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`Edit ${category.name}`}
                      title="Edit"
                      onClick={() => onEdit(category)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Delete ${category.name}`}
                      title="Delete"
                      onClick={() => onDelete(category)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
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
