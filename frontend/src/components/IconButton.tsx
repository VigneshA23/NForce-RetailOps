import type { LucideIcon } from 'lucide-react';
import './IconButton.css';

interface IconButtonProps {
  icon: LucideIcon;
  ariaLabel: string;
  onClick?: () => void;
  variant?: 'default' | 'accent';
  active?: boolean;
  size?: number;
}

function IconButton({
  icon: Icon,
  ariaLabel,
  onClick,
  variant = 'default',
  active = false,
  size = 18,
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
    </button>
  );
}

export default IconButton;
