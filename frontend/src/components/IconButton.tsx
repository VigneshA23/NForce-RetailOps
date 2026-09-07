import type { LucideIcon } from 'lucide-react';
import './IconButton.css';

interface IconButtonProps {
  icon: LucideIcon;
  ariaLabel: string;
  onClick?: () => void;
  variant?: 'default' | 'accent';
  active?: boolean;
  size?: number;
  // Small unread-style count badge in the corner -- omitted entirely when 0/undefined,
  // so every existing caller (which never passes this) renders exactly as before.
  badgeCount?: number;
}

function IconButton({
  icon: Icon,
  ariaLabel,
  onClick,
  variant = 'default',
  active = false,
  size = 18,
  badgeCount,
}: IconButtonProps) {
  const className = [
    'icon-button',
    variant === 'accent' ? 'icon-button--accent' : '',
    active ? 'icon-button--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={className} aria-label={ariaLabel} onClick={onClick}>
      <Icon size={size} />
      {Boolean(badgeCount) && (
        <span className="icon-button__badge" aria-hidden="true">
          {badgeCount! > 9 ? '9+' : badgeCount}
        </span>
      )}
    </button>
  );
}

export default IconButton;
