import type { ReactNode } from 'react';
import { ChevronDown, Store as StoreIcon } from 'lucide-react';
import './StoreAccordionGroup.css';

interface StoreAccordionGroupProps {
  storeName: string;
  supplierCount: number;
  orderCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

// Collapsible store header + body used by all 3 Purchasing Report variants --
// Super Admin's cross-store page renders one of these per store, Owner/Admin's
// and Super Admin's own per-store Orders page each render exactly one (kept
// for visual consistency rather than skipping straight to the bare table).
function StoreAccordionGroup({ storeName, supplierCount, orderCount, isExpanded, onToggle, children }: StoreAccordionGroupProps) {
  return (
    <div className="store-accordion-group">
      <button
        type="button"
        className="store-accordion-group__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {/* Same Store icon tile treatment as the Suppliers table's own
            per-store breakdown rows (SuperAdminInventory.css
            .supplier-table__store-icon) -- reused here for the accordion's
            store header instead of a generic map pin. */}
        <span className="store-accordion-group__icon">
          <StoreIcon size={13} aria-hidden="true" />
        </span>
        <span className="store-accordion-group__name">{storeName}</span>
        <span className="badge badge--info store-accordion-group__count">
          {supplierCount} supplier{supplierCount === 1 ? '' : 's'}
        </span>
        <span className="store-accordion-group__orders">Orders: {orderCount}</span>
        <ChevronDown
          size={16}
          className={`store-accordion-group__chevron${isExpanded ? ' store-accordion-group__chevron--expanded' : ''}`}
          aria-hidden="true"
        />
      </button>
      {isExpanded && <div className="store-accordion-group__body">{children}</div>}
    </div>
  );
}

export default StoreAccordionGroup;
