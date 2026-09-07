import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CircleCheck, Percent, Store as StoreIcon } from 'lucide-react';
import { getPlatformStats, getOperationsOverview, getPlatformTrend } from '../api/superAdminOperations';
import type { PlatformStats, StoreOperationsSummary, TrendDataPoint } from '../api/superAdminOperations';
import type { OwnerSummary } from '../types/owner';
import StatCard from '../components/StatCard';
import StoreComparisonTable from '../components/StoreComparisonTable';
import StoreComparisonDetailModal from '../components/StoreComparisonDetailModal';
import TrendChart from '../components/TrendChart';
import './SuperAdminHome.css';

interface SuperAdminHomeProps {
  owners: OwnerSummary[];
  ownersLoading: boolean;
  onStoreClick?: (storeId: number) => void;
}

const TREND_PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
] as const;

function SuperAdminHome({ owners, ownersLoading, onStoreClick }: SuperAdminHomeProps) {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [overview, setOverview] = useState<StoreOperationsSummary[] | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [trendDays, setTrendDays] = useState<7 | 30>(30);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [detailStore, setDetailStore] = useState<StoreOperationsSummary | null>(null);

  useEffect(() => {
    let active = true;

    getPlatformStats().then((stats) => {
      if (active) setPlatformStats(stats);
    }).catch(() => {});

    setOverviewLoading(true);
    getOperationsOverview().then((data) => {
      if (active) {
        setOverview(data);
        setOverviewLoading(false);
      }
    }).catch(() => {
      if (active) setOverviewLoading(false);
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setTrendLoading(true);
    getPlatformTrend(trendDays)
      .then((data) => { if (active) { setTrendData(data); setTrendLoading(false); } })
      .catch(() => { if (active) setTrendLoading(false); });
    return () => { active = false; };
  }, [trendDays]);

  const uniqueOwnerCount = useMemo(
    () => new Set(owners.map((o) => o.ownerId)).size,
    [owners],
  );
  const activeOwnerCount = useMemo(
    () => new Set(owners.filter((o) => o.ownerActive).map((o) => o.ownerId)).size,
    [owners],
  );
  const totalStoreCount = useMemo(
    () => owners.filter((o) => o.storeId != null).length,
    [owners],
  );

  const needsAttention = useMemo(
    () => (overview ?? []).filter((s) => s.lastActivityAt === null && s.totalTasks > 0),
    [overview],
  );

  return (
    <div className="sa-home">
      <div className="stat-card-row">
        {ownersLoading ? (
          <>
            <StatCard icon={Building2} label="Total Owners" value="—" tone="primary" />
            <StatCard icon={CircleCheck} label="Active Owners" value="—" tone="success" />
            <StatCard icon={StoreIcon} label="Total Stores" value="—" tone="info" />
          </>
        ) : (
          <>
            <StatCard icon={Building2} label="Total Owners" value={uniqueOwnerCount} tone="primary" />
            <StatCard icon={CircleCheck} label="Active Owners" value={activeOwnerCount} tone="success" />
            <StatCard icon={StoreIcon} label="Total Stores" value={totalStoreCount} tone="info" />
          </>
        )}
        {platformStats === null ? (
          <>
            <StatCard icon={Percent} label="Platform Completion" value="—" tone="warning" />
            <StatCard icon={AlertTriangle} label="Open Issues" value="—" tone="info" />
          </>
        ) : (
          <>
            <StatCard icon={Percent} label="Platform Completion" value={`${platformStats.platformCompletionPercent}%`} tone="warning" />
            <StatCard
              icon={AlertTriangle}
              label="Open Issues"
              value={platformStats.totalOpenIssues > 0 ? platformStats.totalOpenIssues : 'All clear'}
              tone={platformStats.totalOpenIssues > 0 ? 'primary' : 'success'}
            />
          </>
        )}
      </div>

      <div className="sa-home__trend-section">
        <div className="sa-home__trend-header">
          <h2 className="sa-home__section-title" style={{ margin: 0 }}>Platform Completion Trend</h2>
          <div className="sa-home__trend-toggle">
            {TREND_PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                className={`sa-home__trend-btn${trendDays === p.days ? ' sa-home__trend-btn--active' : ''}`}
                onClick={() => setTrendDays(p.days as 7 | 30)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <TrendChart data={trendData} loading={trendLoading} height={200} />
      </div>

      {needsAttention.length > 0 && (
        <div className="sa-home__attention">
          <h3 className="sa-home__attention-title">Needs Attention</h3>
          <div className="sa-home__attention-list">
            {needsAttention.map((s) => (
              <div key={s.storeId} className="sa-home__attention-item">
                <span className="sa-home__attention-store">{s.storeName}</span>
                <span className="sa-home__attention-detail">No activity today · {s.totalTasks} task{s.totalTasks === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="sa-home__section-title">Store Performance</h2>
      <StoreComparisonTable
        stores={overview ?? []}
        isLoading={overviewLoading}
        onStoreClick={onStoreClick}
        onViewDetail={setDetailStore}
      />

      <StoreComparisonDetailModal
        store={detailStore}
        onClose={() => setDetailStore(null)}
      />
    </div>
  );
}

export default SuperAdminHome;
