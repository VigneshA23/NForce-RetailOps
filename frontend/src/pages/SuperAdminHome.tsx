import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellOff, Building2, Calendar, Clock, ListChecks, Percent, ShieldCheck, Store as StoreIcon, Tags, Users } from 'lucide-react';
import { getPlatformStats, getOperationsOverview, getPlatformTrend } from '../api/superAdminOperations';
import type { PlatformStats, StoreOperationsSummary, TrendDataPoint } from '../api/superAdminOperations';
import type { OwnerSummary } from '../types/owner';
import StatCard from '../components/StatCard';
import StoreComparisonTable from '../components/StoreComparisonTable';
import StoreComparisonDetailModal from '../components/StoreComparisonDetailModal';
import CompletionRateCard from '../components/CompletionRateCard';
import ActivityFeedList from '../components/ActivityFeedList';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { firstName } from '../utils/initials';
import { formatTrendDayLabel } from '../utils/checklistHistoryOptions';
import './SuperAdminHome.css';

const ACTIVITY_COLLAPSED_LIMIT = 8;

interface SuperAdminHomeProps {
  userName: string;
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
  onViewAllActivity?: () => void;
}

function SuperAdminHome({
  userName,
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
  onViewAllActivity,
}: SuperAdminHomeProps) {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [overview, setOverview] = useState<StoreOperationsSummary[] | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(7);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [detailStore, setDetailStore] = useState<StoreOperationsSummary | null>(null);
  const recentActivity = useRecentActivity(ACTIVITY_COLLAPSED_LIMIT);

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
    getPlatformTrend(trendDays)
      .then((data) => { if (active) setTrendData(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [trendDays]);

  const completionTrend = useMemo(
    () => trendData.map((point) => ({
      day: formatTrendDayLabel(point.date, trendDays),
      completion: point.completionPercent,
    })),
    [trendData, trendDays],
  );

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    [],
  );

  const uniqueOwnerCount = useMemo(
    () => new Set(owners.map((o) => o.ownerId)).size,
    [owners],
  );
  const needsAttention = useMemo(
    () => (overview ?? []).filter((s) => s.lastActivityAt === null && s.totalTasks > 0),
    [overview],
  );

  const healthRows = useMemo(() => {
    if (!platformStats) return [];
    const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));
    return [
      {
        key: 'owners',
        icon: Building2,
        label: 'Owners logged in today',
        value: platformStats.ownersLoggedInToday,
        total: platformStats.totalOwners,
        percent: pct(platformStats.ownersLoggedInToday, platformStats.totalOwners),
        tone: 'good',
      },
      {
        key: 'employees',
        icon: Users,
        label: 'Employees with activity today',
        value: platformStats.employeesActiveToday,
        total: platformStats.totalEmployees,
        percent: pct(platformStats.employeesActiveToday, platformStats.totalEmployees),
        tone: 'info',
      },
      {
        key: 'tasks',
        icon: ListChecks,
        label: 'Tasks completed today',
        value: platformStats.completedTasksToday,
        total: platformStats.totalTasksToday,
        percent: pct(platformStats.completedTasksToday, platformStats.totalTasksToday),
        tone: 'accent',
      },
      {
        key: 'issues',
        icon: AlertTriangle,
        label: 'Stores with open issues',
        value: platformStats.storesWithOpenIssues,
        total: platformStats.totalStores,
        percent: pct(platformStats.storesWithOpenIssues, platformStats.totalStores),
        tone: 'danger',
      },
      {
        key: 'inactive',
        icon: BellOff,
        label: 'Stores with no activity',
        value: platformStats.totalStores - platformStats.storesWithActivity,
        total: platformStats.totalStores,
        percent: pct(platformStats.totalStores - platformStats.storesWithActivity, platformStats.totalStores),
        tone: 'warning',
      },
    ] as const;
  }, [platformStats]);

  return (
    <div className="sa-home">
      <div className="sa-home__heading-row">
        <h1 className="sa-home__greeting">Welcome, {firstName(userName)}!</h1>
        <span className="sa-home__date">
          <Calendar size={13} aria-hidden="true" />
          {todayLabel}
        </span>
      </div>

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

      <div className="sa-home__insights-row">
        <CompletionRateCard
          title="Platform Completion Trend"
          trend={completionTrend}
          periodDays={trendDays}
          onPeriodChange={setTrendDays}
          todayCompletion={platformStats?.platformCompletionPercent ?? 0}
          chartHeight={130}
        />

        <div className="sa-home__health-panel">
          <h2 className="sa-home__health-title">
            <ShieldCheck size={18} />
            Platform Health
          </h2>
          {healthRows.length === 0 ? (
            <p className="sa-home__health-empty">Loading…</p>
          ) : (
            <div className="sa-home__health-rows">
              {healthRows.map((row) => (
                <div key={row.key} className="sa-home__health-row">
                  <span className={`sa-home__health-icon sa-home__health-icon--${row.tone}`}>
                    <row.icon size={14} />
                  </span>
                  <div className="sa-home__health-row-main">
                    <span className="sa-home__health-label">{row.label}</span>
                    <div className="sa-home__health-bar-track">
                      <div
                        className={`sa-home__health-bar-fill sa-home__health-bar-fill--${row.tone}`}
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </div>
                  <span className="sa-home__health-value">{row.value}/{row.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sa-home__health-panel">
          <div className="sa-home__activity-header">
            <h2 className="sa-home__health-title">
              <Clock size={18} />
              Recent Activity
            </h2>
            {onViewAllActivity && (
              <button
                type="button"
                className="chart-card__link-action"
                onClick={onViewAllActivity}
              >
                View all
              </button>
            )}
          </div>
          <ActivityFeedList entries={recentActivity} />
        </div>
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
