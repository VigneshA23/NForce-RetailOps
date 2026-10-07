import { Apple, Milk, Package, ShoppingBag, SprayCan, Wheat } from 'lucide-react';
import type { InventoryItemCategory } from '../types/storeInventory';
import { useInventoryImageUrl } from '../hooks/useInventoryImageUrl';
import './CategoryIcon.css';

// Exported so other surfaces needing this same category color scheme (e.g.
// OrderList's mobile category pill) share one definition instead of a second,
// possibly-drifting copy of the palette.
export const CATEGORY_VISUAL: Record<InventoryItemCategory, { bg: string; fg: string; border: string; Icon: typeof Milk }> = {
  DAIRY: { bg: '#eef5ff', fg: '#2563eb', border: '#d7e6fd', Icon: Milk },
  FRUITS: { bg: '#fdf0f3', fg: '#e11d48', border: '#f9d3dc', Icon: Apple },
  PACKAGING: { bg: '#fdf5e8', fg: '#b45309', border: '#f5dfbd', Icon: Package },
  INGREDIENTS: { bg: '#f6f0fd', fg: '#7c3aed', border: '#e4d6fa', Icon: Wheat },
  SUPPLIES: { bg: '#eefaf4', fg: '#15803d', border: '#cdeedb', Icon: ShoppingBag },
  CLEANING: { bg: '#eefafa', fg: '#0e7490', border: '#c9ecef', Icon: SprayCan },
};

export const FALLBACK_CATEGORY_VISUAL = { bg: '#f4f4f5', fg: '#71717a', border: '#e4e4e7', Icon: Package };

interface CategoryIconProps {
  category: InventoryItemCategory | null;
  name: string;
  size?: number;
  // The item's stored display image; the category icon shows until it loads.
  imageId?: number | null;
}

function CategoryIcon({ category, name, size = 40, imageId }: CategoryIconProps) {
  const imageUrl = useInventoryImageUrl(imageId);
  const visual = category ? CATEGORY_VISUAL[category] : FALLBACK_CATEGORY_VISUAL;
  const Icon = visual.Icon;
  if (imageUrl) {
    return (
      <img
        className="category-icon category-icon--image"
        src={imageUrl}
        alt={`${name} photo`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`${name} photo`}
      className="category-icon"
      style={{
        width: size,
        height: size,
        background: visual.bg,
        color: visual.fg,
        borderColor: visual.border,
      }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </span>
  );
}

export default CategoryIcon;
