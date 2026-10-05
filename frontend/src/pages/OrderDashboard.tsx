import { useEffect, useRef, useState } from 'react';
import OrderList from './OrderList';
import InventoryCounts from '../components/InventoryCounts';
import EodSupplierReport from '../components/EodSupplierReport';
import SupplierPurchaseReport from '../components/SupplierPurchaseReport';
import './OrderDashboard.css';

type SubTab = 'orders' | 'counts' | 'eod-report' | 'supplier-report';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'orders', label: 'Order List' },
  { key: 'counts', label: 'Inventory Counts' },
  { key: 'eod-report', label: 'End of Day Report' },
  { key: 'supplier-report', label: 'Supplier Purchasing Summary' },
];

interface OrderDashboardProps {
  storeName?: string | null;
  // Set by the shell when arriving from the Home low-stock tile, to open this
  // tab already filtered. `id` is a nonce, not data -- see the effect below.
  seed?: { status: string; id: number };
}

function OrderDashboard({ storeName, seed }: OrderDashboardProps) {
  const [subTab, setSubTab] = useState<SubTab>('orders');

  // Arriving from the Home low-stock tile should land on Order List even if
  // another sub-tab was last active -- same nonce-guard pattern as the seed
  // itself, so this only fires once per seed, not on every re-render.
  const appliedSeedId = useRef<number | null>(null);
  useEffect(() => {
    if (!seed || seed.id === appliedSeedId.current) return;
    appliedSeedId.current = seed.id;
    setSubTab('orders');
  }, [seed]);

  return (
    <div className="order-dashboard-page">
      <div className="order-dashboard-page__subtabs">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`order-dashboard-page__subtab${subTab === tab.key ? ' order-dashboard-page__subtab--active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'orders' && <OrderList storeName={storeName} seed={seed} />}
      {subTab === 'counts' && <InventoryCounts />}
      {subTab === 'eod-report' && <EodSupplierReport storeName={storeName} />}
      {subTab === 'supplier-report' && <SupplierPurchaseReport />}
    </div>
  );
}

export default OrderDashboard;
