import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import './TaskRowActions.css';

interface TaskRowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

const MENU_WIDTH = 140;

function TaskRowActions({ onEdit, onDelete }: TaskRowActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.right - MENU_WIDTH });
    setIsMenuOpen(true);
  }

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }
    function handleScrollOrResize() {
      setIsMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isMenuOpen]);

  return (
    <div className="task-row-actions">
      <button
        ref={triggerRef}
        type="button"
        className="task-row-actions__icon"
        aria-label="Task actions"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={() => (isMenuOpen ? setIsMenuOpen(false) : openMenu())}
      >
        <MoreVertical size={16} />
      </button>
      {isMenuOpen &&
        createPortal(
          <div ref={menuRef} className="task-row-actions__menu" role="menu" style={{ top: position.top, left: position.left }}>
            <button
              type="button"
              role="menuitem"
              className="task-row-actions__menu-item"
              onClick={() => {
                setIsMenuOpen(false);
                onEdit();
              }}
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="task-row-actions__menu-item task-row-actions__menu-item--danger"
              onClick={() => {
                setIsMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default TaskRowActions;
