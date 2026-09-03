import { useEffect, useRef, useState } from 'react';
import { HelpCircle, LogOut, User as UserIcon } from 'lucide-react';
import UserAvatar from './UserAvatar';
import ConfirmDialog from './ConfirmDialog';
import './ProfileMenu.css';

interface ProfileMenuProps {
  fullName: string;
  avatarUrl?: string | null;
  onProfileClick?: () => void;
  onHelpClick?: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
}

function getInitials(fullName: string): string {
  return fullName.charAt(0).toUpperCase() || '?';
}

function ProfileMenu({ fullName, avatarUrl, onProfileClick, onHelpClick, onLogout, loggingOut = false }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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
    <div className="profile-menu" ref={containerRef}>
      <button
        type="button"
        className="profile-menu__trigger"
        aria-label={`Signed in as ${fullName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <UserAvatar initials={getInitials(fullName)} src={avatarUrl} />
      </button>
      {isOpen && (
        <div className="profile-menu__dropdown" role="menu">
          <div className="profile-menu__name">{fullName}</div>
          {onProfileClick && (
            <button
              type="button"
              role="menuitem"
              className="profile-menu__item"
              onClick={() => {
                setIsOpen(false);
                onProfileClick();
              }}
            >
              <UserIcon size={14} />
              My Profile
            </button>
          )}
          {onHelpClick && (
            <button
              type="button"
              role="menuitem"
              className="profile-menu__item"
              onClick={() => {
                setIsOpen(false);
                onHelpClick();
              }}
            >
              <HelpCircle size={14} />
              Help &amp; Guidance
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="profile-menu__item profile-menu__item--danger"
            disabled={loggingOut}
            onClick={() => {
              setIsOpen(false);
              setIsConfirmOpen(true);
            }}
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      )}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmLabel={loggingOut ? 'Logging out…' : 'Log out'}
        cancelLabel="Cancel"
        danger
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onLogout();
        }}
      />
    </div>
  );
}

export default ProfileMenu;
