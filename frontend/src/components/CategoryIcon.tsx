import { Apple, Milk, Package, ShoppingBag, SprayCan, Wheat } from 'lucide-react';
import type { InventoryItemCategory } from '../types/storeInventory';
import './CategoryIcon.css';

const CATEGORY_VISUAL: Record<InventoryItemCategory, { bg: string; fg: string; border: string; Icon: typeof Milk }> = {
  DAIRY: { bg: '#eef5ff', fg: '#2563eb', border: '#d7e6fd', Icon: Milk },
  FRUITS: { bg: '#fdf0f3', fg: '#e11d48', border: '#f9d3dc', Icon: Apple },
  PACKAGING: { bg: '#fdf5e8', fg: '#b45309', border: '#f5dfbd', Icon: Package },
  INGREDIENTS: { bg: '#f6f0fd', fg: '#7c3aed', border: '#e4d6fa', Icon: Wheat },
  SUPPLIES: { bg: '#eefaf4', fg: '#15803d', border: '#cdeedb', Icon: ShoppingBag },
  CLEANING: { bg: '#eefafa', fg: '#0e7490', border: '#c9ecef', Icon: SprayCan },
};

const FALLBACK = { bg: '#f4f4f5', fg: '#71717a', border: '#e4e4e7', Icon: Package };

interface CategoryIconProps {
  category: InventoryItemCategory | null;
  name: string;
  size?: number;
}

function CategoryIcon({ category, name, size = 40 }: CategoryIconProps) {
  const visual = category ? CATEGORY_VISUAL[category] : FALLBACK;
  const Icon = visual.Icon;
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
