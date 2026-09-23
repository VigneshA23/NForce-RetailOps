import { CalendarX, ChevronRight } from 'lucide-react'
import './MissedTasksBanner.css'

interface MissedTasksBannerProps {
  count: number
  onClick: () => void
}

// Dashboard entry point into the dedicated Missing Tasks page -- replaces the
// old embedded MissedTasksPanel with a compact summary so the actionable UI
// lives in one place.
function MissedTasksBanner({ count, onClick }: MissedTasksBannerProps) {
  if (count <= 0) return null

  return (
    <button type="button" className="missed-tasks-banner" onClick={onClick}>
      <span className="missed-tasks-banner__icon">
        <CalendarX size={18} aria-hidden="true" />
      </span>
      <span className="missed-tasks-banner__text">
        <strong>{count}</strong> missed task{count === 1 ? '' : 's'} from previous days need attention
      </span>
      <ChevronRight size={16} className="missed-tasks-banner__chevron" aria-hidden="true" />
    </button>
  )
}

export default MissedTasksBanner
