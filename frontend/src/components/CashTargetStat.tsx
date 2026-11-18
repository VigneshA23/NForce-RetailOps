import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import StatCard from './StatCard';
import { getCashTarget, getSuperAdminCashTarget } from '../api/storeCashTarget';
import { formatCurrency } from '../utils/currency';

interface CashTargetStatProps {
  // 'owner': the server resolves the caller's own store. 'super-admin':
  // storeId is sent explicitly.
  scope: 'owner' | 'super-admin';
  storeId: number;
}

// The store's cash target as a read-only tile on Daily Cash. Display only:
// there is deliberately no way to change it from here.
function CashTargetStat({ scope, storeId }: CashTargetStatProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // A different store's target must never linger while the new one loads.
    setAmount(null);
    setFailed(false);
    const controller = new AbortController();
    const request = scope === 'super-admin'
      ? getSuperAdminCashTarget(storeId, controller.signal)
      : getCashTarget(controller.signal);
    request
      .then((result) => setAmount(result.targetAmount))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [scope, storeId]);

  return (
    <div aria-live="polite">
      <StatCard
        icon={Target}
        label="Cash target"
        value={failed ? 'Unavailable' : amount === null ? 'Loading…' : formatCurrency(amount)}
        tone={failed ? 'warning' : 'info'}
      />
    </div>
  );
}

export default CashTargetStat;
