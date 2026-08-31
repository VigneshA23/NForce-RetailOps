import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import './RowActionsMenu.css';

interface RowActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  // Optional: tables whose rows can be activated/deactivated pass both of these.
  // Omitting them keeps the plain Edit/Delete menu.
  onToggleStatus?: () => void;
  isActive?: boolean;
}

const MENU_WIDTH = 168;

function RowActionsMenu({ onEdit, onDelete, onToggleStatus, isActive }: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.right - MENU_WIDTH });
    }
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    // Simplest robust fix for a portal-rendered menu: close on scroll rather
    // than tracking the trigger's position continuously.
    function handleScrollOrResize() {
      setIsOpen(false);
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
  }, [isOpen]);

  return (
    <div className="row-actions">
      <button
        ref={triggerRef}
        type="button"
        className="row-actions__trigger"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
      >
        <MoreVertical size={18} />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="row-actions__menu row-actions__menu--portal"
            role="menu"
            style={{ top: position.top, left: position.left }}
          >
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
            {onToggleStatus && (
              <button
                type="button"
                role="menuitem"
                className="row-actions__item"
                onClick={() => {
                  setIsOpen(false);
                  onToggleStatus();
                }}
              >
                {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                {isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}
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
          </div>,
          document.body,
        )}
    </div>
  );
}

export default RowActionsMenu;
