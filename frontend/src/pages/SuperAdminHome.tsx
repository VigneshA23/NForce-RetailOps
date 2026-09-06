import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CircleCheck, Percent, Store as StoreIcon } from 'lucide-react';
import { getPlatformStats, getOperationsOverview } from '../api/superAdminOperations';
import type { PlatformStats, StoreOperationsSummary } from '../api/superAdminOperations';
import type { OwnerSummary } from '../types/owner';
import StatCard from '../components/StatCard';
import StoreComparisonTable from '../components/StoreComparisonTable';
import './SuperAdminHome.css';

interface SuperAdminHomeProps {
  owners: OwnerSummary[];
  ownersLoading: boolean;
  onStoreClick?: (storeId: number) => void;
}

function SuperAdminHome({ owners, ownersLoading, onStoreClick }: SuperAdminHomeProps) {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [overview, setOverview] = useState<StoreOperationsSummary[] | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

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
      />
    </div>
  );
}

export default SuperAdminHome;
