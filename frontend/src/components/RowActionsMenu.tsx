import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import './RowActionsMenu.css';

interface RowActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

function RowActionsMenu({ onEdit, onDelete }: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="row-actions" ref={containerRef}>
      <button
        type="button"
        className="row-actions__trigger"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <MoreVertical size={18} />
      </button>
      {isOpen && (
        <div className="row-actions__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="row-actions__item"
            onClick={() => {
              setIsOpen(false);
              onEdit();
            }}
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="row-actions__item row-actions__item--danger"
            onClick={() => {
              setIsOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default RowActionsMenu;
