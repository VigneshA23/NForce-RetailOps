import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import StatCard from './StatCard';
import { getExpectedCashAsOf, getSuperAdminExpectedCashAsOf } from '../api/storeCash';
import { formatCurrency } from '../utils/currency';

interface ExpectedCashOnHandStatProps {
  // 'owner': the server resolves the caller's own store. 'super-admin':
  // storeId is sent explicitly.
  scope: 'owner' | 'super-admin';
  storeId: number;
  // YYYY-MM-DD: the figure is the running total up to and including this day.
  date: string;
  // Bumped by the parent after each save/correction so the figure refetches.
  refreshKey: number;
}

// Expected Cash on Hand as of the viewed date (RTS-554): the server's sum of
// every day's expected cash (cash remaining ± other adjustments) from the
// store's first entry up to the date. Days with no entry add 0, so the figure
// shows even when the selected day has no entry. Never computed here, and
// never shown to employees.
function ExpectedCashOnHandStat({ scope, storeId, date, refreshKey }: ExpectedCashOnHandStatProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  // A different store's or date's figure must never linger while the new one loads.
  useEffect(() => {
    setAmount(null);
    setFailed(false);
  }, [scope, storeId, date]);

  useEffect(() => {
    const controller = new AbortController();
    const request = scope === 'super-admin'
      ? getSuperAdminExpectedCashAsOf(storeId, date, controller.signal)
      : getExpectedCashAsOf(date, controller.signal);
    request
      .then((result) => { setAmount(result.expectedCashOnHand); setFailed(false); })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [scope, storeId, date, refreshKey]);

  return (
    <div aria-live="polite">
      <StatCard
        icon={Wallet}
        label="Expected Cash on Hand"
        value={failed ? 'Unavailable' : amount === null ? 'Loading…' : formatCurrency(amount)}
        caption={failed || amount === null ? undefined : `As of ${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
        tone={failed ? 'warning' : 'primary'}
      />
    </div>
  );
}

export default ExpectedCashOnHandStat;
