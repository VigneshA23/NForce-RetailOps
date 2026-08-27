import { useEffect, useRef, useState } from 'react';
import { HelpCircle, LogOut, User as UserIcon } from 'lucide-react';
import UserAvatar from './UserAvatar';
import './UserMenu.css';

interface UserMenuProps {
  fullName: string;
  roleLabel: string;
  initials: string;
  onProfileClick: () => void;
  onHelpClick: () => void;
  onSignOut: () => void;
}

const ORG_NAME = 'NForce RetailOps';

function UserMenu({ fullName, roleLabel, initials, onProfileClick, onHelpClick, onSignOut }: UserMenuProps) {
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
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <UserAvatar initials={initials} />
      </button>

      {isOpen && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__header">
            <UserAvatar initials={initials} size={40} />
            <div className="user-menu__identity">
              <div className="user-menu__name">{fullName}</div>
              <div className="user-menu__role">
                {roleLabel} · {ORG_NAME}
              </div>
            </div>
          </div>

          <div className="user-menu__divider" />

          <button
            type="button"
            role="menuitem"
            className="user-menu__item"
            onClick={() => {
              setIsOpen(false);
              onProfileClick();
            }}
          >
            <UserIcon size={16} />
            My Profile
          </button>
          <button
            type="button"
            role="menuitem"
            className="user-menu__item"
            onClick={() => {
              setIsOpen(false);
              onHelpClick();
            }}
          >
            <HelpCircle size={16} />
            Help &amp; Guidance
          </button>

          <div className="user-menu__divider" />

          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={() => {
              setIsOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
