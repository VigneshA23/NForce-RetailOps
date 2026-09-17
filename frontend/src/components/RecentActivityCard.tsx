import { useRecentActivity } from '../hooks/useRecentActivity';
import ActivityFeedList from './ActivityFeedList';
import ChartCard from './ChartCard';

const COLLAPSED_LIMIT = 8;

interface RecentActivityCardProps {
  onViewAll?: () => void;
}

function RecentActivityCard({ onViewAll }: RecentActivityCardProps) {
  const entries = useRecentActivity(COLLAPSED_LIMIT);

  return (
    <ChartCard
      title="Recent Activity"
      subtitle="Latest task completions by your team"
      height={320}
      headerRight={
        onViewAll && (
          <button type="button" className="chart-card__link-action" onClick={onViewAll}>
            View all
          </button>
        )
      }
    >
      <ActivityFeedList entries={entries} />
    </ChartCard>
  );
}

export default RecentActivityCard;
