import { useEffect, useRef, useState } from 'react';
import OrderList from './OrderList';
import InventoryCounts from '../components/InventoryCounts';
import EodSupplierReport from '../components/EodSupplierReport';
import SupplierPurchaseReport from '../components/SupplierPurchaseReport';
import './OrderDashboard.css';

type SubTab = 'orders' | 'counts' | 'eod-report' | 'supplier-report';

// shortLabel is what mobile shows instead -- these full labels don't fit a
// 4-way pill tab at phone width the way they do as underline tabs with room
// to breathe.
const SUB_TABS: { key: SubTab; label: string; shortLabel: string }[] = [
  { key: 'orders', label: 'Order List', shortLabel: 'Orders' },
  { key: 'counts', label: 'Inventory Counts', shortLabel: 'Inventory' },
  { key: 'eod-report', label: 'End of Day Report', shortLabel: 'Report' },
  { key: 'supplier-report', label: 'Purchasing Report', shortLabel: 'Purchases' },
];

interface OrderDashboardProps {
  storeName?: string | null;
  // Set by the shell when arriving from the Home low-stock tile, to open this
  // tab already filtered. `id` is a nonce, not data -- see the effect below.
  seed?: { status: string; id: number };
}

function OrderDashboard({ storeName, seed }: OrderDashboardProps) {
  const [subTab, setSubTab] = useState<SubTab>('orders');
  const [purchaseSeed, setPurchaseSeed] = useState<{ supplierName: string; id: number } | null>(null);

  // Arriving from the Home low-stock tile should land on Order List even if
  // another sub-tab was last active -- same nonce-guard pattern as the seed
  // itself, so this only fires once per seed, not on every re-render.
  const appliedSeedId = useRef<number | null>(null);
  useEffect(() => {
    if (!seed || seed.id === appliedSeedId.current) return;
    appliedSeedId.current = seed.id;
    setSubTab('orders');
  }, [seed]);

  // Purchasing Report's "View Details" link -- fully local to this page
  // (Order List and Purchasing Report are both its own sub-tabs), unlike
  // Super Admin's equivalent which has to bubble up to a separate
  // top-level page. The date range from SupplierPurchaseReport's own
  // onViewDetails callback is intentionally dropped here: Order List has no
  // date-filtering concept to apply it to.
  function handleViewPurchaseDetails(supplierName: string) {
    setPurchaseSeed({ supplierName, id: Date.now() });
    setSubTab('orders');
  }

  return (
    <div className="order-dashboard-page">
      <div className="order-dashboard-page__subtabs">
        <div className="order-dashboard-page__subtab-list">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`order-dashboard-page__subtab${subTab === tab.key ? ' order-dashboard-page__subtab--active' : ''}`}
              onClick={() => setSubTab(tab.key)}
              aria-label={tab.label}
            >
              {/* Which span is visible is CSS-only (mobile swaps to shortLabel) --
                  aria-label above keeps the accessible name (and so this button's
                  test/screen-reader identity) at the full label regardless. */}
              <span className="order-dashboard-page__subtab-label-full" aria-hidden="true">{tab.label}</span>
              <span className="order-dashboard-page__subtab-label-short" aria-hidden="true">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {subTab === 'orders' && <OrderList storeName={storeName} seed={seed} purchaseSeed={purchaseSeed ?? undefined} />}
      {subTab === 'counts' && <InventoryCounts />}
      {subTab === 'eod-report' && <EodSupplierReport storeName={storeName} />}
      {subTab === 'supplier-report' && (
        <SupplierPurchaseReport storeName={storeName} onViewDetails={(supplierName) => handleViewPurchaseDetails(supplierName)} />
      )}
    </div>
  );
}

export default OrderDashboard;
