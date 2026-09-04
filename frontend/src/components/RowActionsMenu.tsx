import { Pencil, Trash2 } from 'lucide-react';
import './RowActionsMenu.css';

interface RowActionsMenuProps {
  onEdit: () => void;
  onDelete?: () => void;
}

function RowActionsMenu({ onEdit, onDelete }: RowActionsMenuProps) {
  return (
    <div className="row-actions">
      <button
        type="button"
        className="row-actions__btn row-actions__btn--edit"
        aria-label="Edit"
        onClick={onEdit}
      >
        <Pencil size={15} />
      </button>
      {onDelete && (
        <button
          type="button"
          className="row-actions__btn row-actions__btn--delete"
          aria-label="Delete"
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export default RowActionsMenu;
