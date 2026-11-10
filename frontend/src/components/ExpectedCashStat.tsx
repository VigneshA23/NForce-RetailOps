import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import StatCard from './StatCard';
import { getExpectedCash, getSuperAdminExpectedCash } from '../api/storeCash';
import type { ExpectedCash } from '../types/storeCash';
import { formatCurrency } from '../utils/currency';
import './ExpectedCashStat.css';

interface ExpectedCashStatProps {
  // 'owner': the server resolves the caller's own store. 'super-admin':
  // storeId is sent explicitly.
  scope: 'owner' | 'super-admin';
  storeId: number;
  // Bumped by the parent after each successful save to refetch the figure.
  refreshKey: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Whole days between a YYYY-MM-DD business date and today, both local.
function daysAgo(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  const asOf = new Date(year, month - 1, day).getTime();
  return Math.round((localMidnight(new Date()) - asOf) / DAY_MS);
}

function formatAsOf(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Same style as the Daily Cash "Saved · last updated" status line.
function formatLastUpdated(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function load(scope: 'owner' | 'super-admin', storeId: number, signal: AbortSignal) {
  return scope === 'super-admin' ? getSuperAdminExpectedCash(storeId, signal) : getExpectedCash(signal);
}

// Expected Cash on Hand (RTS-296): the server's live figure for the store
// (RTS-295) -- never recomputed here. It always comes from the latest saved
// entry, however old (BA-confirmed "option a"); an entry older than yesterday
// is flagged rather than hidden, and "Last updated" says when that entry was
// entered. "No data yet" is deliberately not a dollar amount so it can't be
// mistaken for $0.00.
function ExpectedCashStat({ scope, storeId, refreshKey }: ExpectedCashStatProps) {
  const [data, setData] = useState<ExpectedCash | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(scope, storeId, controller.signal)
      .then((result) => {
        setData(result);
        setFailed(false);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [scope, storeId, refreshKey, retryToken]);

  // A different store's figure must never linger while the new one loads.
  useEffect(() => {
    setData(null);
    setFailed(false);
  }, [scope, storeId]);

  const label = 'Expected Cash on Hand';
  let card;
  let lastUpdated: string | null = null;

  if (failed) {
    card = (
      <StatCard
        icon={Wallet}
        label={label}
        value="Unavailable"
        caption="Couldn't load — tap to retry"
        tone="warning"
        onClick={() => setRetryToken((token) => token + 1)}
      />
    );
  } else if (data === null) {
    card = <StatCard icon={Wallet} label={label} value="Loading…" tone="info" />;
  } else if (!data.available || data.expectedCashOnHand === null || data.asOfDate === null) {
    card = (
      <StatCard
        icon={Wallet}
        label={label}
        value="No data yet"
        caption="Save a daily cash entry to see this figure"
        tone="info"
      />
    );
  } else {
    const age = daysAgo(data.asOfDate);
    const stale = age >= 2;
    const caption = stale
      ? `As of ${formatAsOf(data.asOfDate)} · last entry ${age} days ago`
      : `As of ${formatAsOf(data.asOfDate)}`;
    if (data.lastUpdatedAt) lastUpdated = formatLastUpdated(data.lastUpdatedAt);
    card = (
      <StatCard
        icon={Wallet}
        label={label}
        value={formatCurrency(data.expectedCashOnHand)}
        caption={caption}
        className={stale || data.expectedCashOnHand < 0 ? undefined : 'expected-cash-stat__card--green'}
        tone={stale || data.expectedCashOnHand < 0 ? 'warning' : 'success'}
      />
    );
  }

  return (
    <div className="expected-cash-stat" aria-live="polite">
      {card}
      {lastUpdated && (
        <p className="expected-cash-stat__updated">Last updated {lastUpdated}</p>
      )}
    </div>
  );
}

export default ExpectedCashStat;
