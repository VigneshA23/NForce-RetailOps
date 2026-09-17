import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Percent, Store as StoreIcon, Tags } from 'lucide-react';
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
  // Every store platform-wide, independent of ownership -- fetched by the parent
  // (SuperAdminDashboard) from the Stores list, not derived from `owners` (one row
  // per owner-store link, which silently excludes any store with no owner assigned).
  // null while that fetch is in flight.
  totalStoreCount: number | null;
  // Every category platform-wide (Super Admin's own list, not owner-scoped).
  // null while that fetch is in flight.
  totalCategoryCount: number | null;
  onStoreClick?: (storeId: number) => void;
  onIssuesClick?: () => void;
  onOwnersClick?: () => void;
  onStoresClick?: () => void;
  onCategoriesClick?: () => void;
  onChecklistClick?: () => void;
}

const TREND_PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
] as const;

function SuperAdminHome({
  owners,
  ownersLoading,
  totalStoreCount,
  totalCategoryCount,
  onStoreClick,
  onIssuesClick,
  onOwnersClick,
  onStoresClick,
  onCategoriesClick,
  onChecklistClick,
}: SuperAdminHomeProps) {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [overview, setOverview] = useState<StoreOperationsSummary[] | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
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
  const needsAttention = useMemo(
    () => (overview ?? []).filter((s) => s.lastActivityAt === null && s.totalTasks > 0),
    [overview],
  );

  return (
    <div className="sa-home">
      <div className="stat-card-row">
        {ownersLoading ? (
          <StatCard icon={Building2} label="Total Owners" value="—" tone="primary" onClick={onOwnersClick} />
        ) : (
          <StatCard icon={Building2} label="Total Owners" value={uniqueOwnerCount} tone="primary" onClick={onOwnersClick} />
        )}
        <StatCard icon={StoreIcon} label="Total Stores" value={totalStoreCount ?? '—'} tone="info" onClick={onStoresClick} />
        <StatCard icon={Tags} label="Categories" value={totalCategoryCount ?? '—'} tone="success" onClick={onCategoriesClick} />
        {platformStats === null ? (
          <>
            <StatCard icon={Percent} label="Platform Completion" value="—" tone="warning" onClick={onChecklistClick} />
            <StatCard icon={AlertTriangle} label="Open Issues" value="—" tone="info" onClick={onIssuesClick} />
          </>
        ) : (
          <>
            <StatCard
              icon={Percent}
              label="Platform Completion"
              value={`${platformStats.platformCompletionPercent}%`}
              tone="warning"
              onClick={onChecklistClick}
            />
            <StatCard
              icon={AlertTriangle}
              label="Open Issues"
              value={platformStats.totalOpenIssues > 0 ? platformStats.totalOpenIssues : 'All clear'}
              tone={platformStats.totalOpenIssues > 0 ? 'primary' : 'success'}
              onClick={onIssuesClick}
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
