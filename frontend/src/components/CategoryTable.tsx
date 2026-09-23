import {
  Pencil,
  Trash2,
  GripVertical,
  ClipboardList,
  MapPin,
  Tag,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import type { Category } from '../types/category';
import { formatDateLabel, stepDate, todayDate } from '../utils/checklistHistoryOptions';
import Toggle from './Toggle';
import './CategoryTable.css';

interface CategoryTableProps {
  categories: Category[];
  canManage: boolean;
  canReorder?: boolean;
  isLoading?: boolean;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onToggleStatus?: (category: Category, active: boolean) => void;
  onReorder?: (orderedIds: number[]) => void;
  // Rendered inside the card below the table (e.g. pagination).
  footer?: ReactNode;
}

interface RowSharedProps {
  category: Category;
  canManage: boolean;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onToggleStatus?: (category: Category, active: boolean) => void;
}

function storesLabel(category: Category): string {
  if (category.appliesToAllStores) return 'All Stores';
  if (category.stores.length === 0) return '—';
  return category.stores.map((store) => store.name).join(', ');
}

// "Starts tomorrow" / "Starts Sep 30, 2026" for a category created with
// "Enable Immediately" off that hasn't gone live yet; null once it has.
function startsLabel(category: Category): string | null {
  if (!category.startDate) return null;
  const today = todayDate();
  if (category.startDate <= today) return null;
  return category.startDate === stepDate(today, 1)
    ? 'Starts tomorrow'
    : `Starts ${formatDateLabel(category.startDate)}`;
}

function CategoryRowCells({ category, canManage, onEdit, onDelete, onToggleStatus }: RowSharedProps) {
  const starts = startsLabel(category);
  return (
    <>
      <td className="category-table__name" data-label="Category Name">
        {canManage && (
          <span className={`category-table__icon category-table__icon--${category.badgeColor ?? 'blue'}`} aria-hidden="true">
            <Tag size={18} />
          </span>
        )}
        <span className="category-table__name-text">{category.name}</span>
      </td>
      {canManage && (
        <td className="category-table__stores" data-label="Stores">
          <span className="category-table__stores-text">{storesLabel(category)}</span>
          {/* Mobile-only: heading + one chip per store (hidden on desktop via CSS). */}
          <span className="category-table__stores-heading">
            <MapPin size={12} aria-hidden="true" />
            {category.appliesToAllStores
              ? 'Assigned Stores'
              : `Assigned Stores (${category.stores.length})`}
          </span>
          <ul className="category-table__store-chips">
            {category.appliesToAllStores ? (
              <li className="category-table__store-chip">All Stores</li>
            ) : category.stores.length === 0 ? (
              <li className="category-table__store-chip category-table__store-chip--empty">No stores assigned</li>
            ) : (
              category.stores.map((store) => (
                <li key={store.id} className="category-table__store-chip">{store.name}</li>
              ))
            )}
          </ul>
        </td>
      )}
      <td className="category-table__task-count" data-label="Tasks">
        {canManage && <ClipboardList size={12} className="category-table__task-icon" aria-hidden="true" />}
        <span className="category-table__task-number">{category.taskCount}</span>
        {canManage && <span className="category-table__task-suffix">Tasks</span>}
      </td>
      <td className="category-table__status" data-label="Status">
        {canManage && onToggleStatus ? (
          <>
            <Toggle
              checked={category.active}
              onChange={(checked) => onToggleStatus(category, checked)}
              label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
            />
            {starts && <span className="category-table__starts">{starts}</span>}
          </>
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
    </>
  );
}

function SortableCategoryRow({ category, canManage, onEdit, onDelete, onToggleStatus }: RowSharedProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`category-table__row category-table__row--reorderable${isDragging ? ' category-table__row--dragging' : ''}`}
    >
      <td className="category-table__drag-cell">
        <button
          type="button"
          className={`table-icon-btn category-table__drag-handle${isDragging ? ' category-table__drag-handle--dragging' : ''}`}
          aria-label={`Reorder ${category.name}`}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </td>
      <CategoryRowCells
        category={category}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
      />
    </tr>
  );
}

function StaticCategoryRow({ category, canManage, onEdit, onDelete, onToggleStatus }: RowSharedProps) {
  return (
    <tr className="category-table__row">
      <CategoryRowCells
        category={category}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
      />
    </tr>
  );
}

function CategoryTable({
  categories,
  canManage,
  canReorder = false,
  isLoading = false,
  onEdit,
  onDelete,
  onToggleStatus,
  onReorder,
  footer,
}: CategoryTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((category) => category.id === active.id);
    const newIndex = categories.findIndex((category) => category.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    onReorder?.(reordered.map((category) => category.id));
  }

  const rows = categories.map((category) =>
    canReorder ? (
      <SortableCategoryRow
        key={category.id}
        category={category}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
      />
    ) : (
      <StaticCategoryRow
        key={category.id}
        category={category}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
      />
    ),
  );

  return (
    <div className={`category-table__card table-card${canManage ? ' category-table__card--managed' : ''}`}>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {canReorder && <th scope="col" className="category-table__drag-header" aria-hidden="true" />}
              <th scope="col">Category Name</th>
              {canManage && <th scope="col">Assigned Stores</th>}
              <th scope="col">Tasks</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col" className="task-table__actions-header">Actions</th>}
            </tr>
          </thead>
          {canReorder ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={categories.map((category) => category.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>{rows}</tbody>
              </SortableContext>
            </DndContext>
          ) : (
            <tbody>{rows}</tbody>
          )}
        </table>
      </div>
      {!isLoading && categories.length === 0 && (
        <div className="category-table__empty">No categories match your filters.</div>
      )}
      {isLoading && <div className="category-table__empty">Loading categories...</div>}
      {footer && <div className="category-table__footer">{footer}</div>}
    </div>
  );
}

export default CategoryTable;
