import './ItemIcon.css';

const VARIANTS = ['primary', 'success', 'warning', 'info', 'purple', 'slate'] as const;
type ItemIconVariant = (typeof VARIANTS)[number];

interface ItemIconProps {
  id: number;
  name: string;
  // 'xl' is the Owner/Admin inventory card's dedicated item-image area --
  // sized to match the real product photo tile once image upload exists.
  size?: 'sm' | 'md' | 'xl';
}

// Placeholder for the future admin/super-admin item image: until that asset
// pipeline exists, every item shows a 3-letter code in a color picked
// deterministically from its id, so it stays stable across reloads.
function initialsFor(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, 3).padEnd(3, letters.charAt(0) || '?');
}

function variantFor(id: number): ItemIconVariant {
  return VARIANTS[Math.abs(id) % VARIANTS.length];
}

function ItemIcon({ id, name, size = 'md' }: ItemIconProps) {
  return (
    <span
      className={`item-icon item-icon--${size}`}
      data-variant={variantFor(id)}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  );
}

export default ItemIcon;
