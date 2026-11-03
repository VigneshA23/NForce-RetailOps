import './StoreChip.css';

// Fixed palette; a store's colour is picked from its name so it stays the same
// everywhere it is shown.
const BADGE_COLORS = ['#6366f1', '#f59e0b', '#0ea5e9', '#10b981', '#0d9488', '#ec4899', '#8b5cf6', '#ef4444'];

function badgeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length];
}

interface StoreChipProps {
  name: string;
}

/** Store name pill led by a coloured circle holding the store's first letter. */
function StoreChip({ name }: StoreChipProps) {
  return (
    <span className="store-chip">
      <span className="store-chip__letter" style={{ background: badgeColor(name) }} aria-hidden="true">
        {name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="store-chip__name">{name}</span>
    </span>
  );
}

export default StoreChip;
