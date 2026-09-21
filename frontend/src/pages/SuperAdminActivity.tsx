import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import SearchInput from '../components/SearchInput';
import Select, { type SelectOption } from '../components/Select';
import ActivityFeedList from '../components/ActivityFeedList';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { matchesSearch } from '../utils/search';
import './SuperAdminActivity.css';

// Server caps `limit` at 100 (ActivityLogController.MAX_LIMIT) -- this is
// the largest single page the API can return.
const FULL_LIMIT = 100;

interface SuperAdminActivityProps {
  // Leaves this page entirely (e.g. back to Home) -- this page is only
  // reachable via "View all", so there's no tab of its own to fall back to.
  onBack?: () => void;
}

function SuperAdminActivity({ onBack }: SuperAdminActivityProps) {
  const entries = useRecentActivity(FULL_LIMIT);
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');

  const storeOptions = useMemo<SelectOption[]>(() => {
    if (!entries) return [];
    const names = Array.from(
      new Set(entries.map((entry) => entry.storeName).filter((name): name is string => Boolean(name))),
    ).sort();
    return names.map((name) => ({ value: name, label: name }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!entries) return entries;
    let result = entries;
    if (storeFilter !== 'all') {
      result = result.filter((entry) => entry.storeName === storeFilter);
    }
    if (search.trim()) {
      result = result.filter((entry) =>
        matchesSearch(search, [entry.actorName, entry.description, entry.storeName, entry.entityName]),
      );
    }
    return result;
  }, [entries, storeFilter, search]);

  return (
    <div className="sa-activity">
      {onBack && (
        <button type="button" className="sa-activity__back" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>
      )}

      <div className="sa-activity__header">
        <h1 className="sa-activity__title">Recent Activity</h1>
        <p className="sa-activity__subtitle">Owner and employee activity across every store, most recent first.</p>
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search activity…" variant="filter" />
        </div>
        {storeOptions.length > 1 && (
          <Select
            className="filter"
            options={[{ value: 'all', label: 'All stores' }, ...storeOptions]}
            value={storeFilter}
            onChange={setStoreFilter}
            ariaLabel="Filter by store"
          />
        )}
      </div>

      <div className="card sa-activity__list-card">
        <ActivityFeedList entries={filteredEntries} />
      </div>
    </div>
  );
}

export default SuperAdminActivity;
