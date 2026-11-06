import './ChecklistLiveStatus.css';

interface ChecklistLiveStatusProps {
  isToday: boolean;
}

// Live / Historical badge beside the date picker, shared by the Owner/Admin
// and Super Admin Daily Checklist pages.
function ChecklistLiveStatus({ isToday }: ChecklistLiveStatusProps) {
  return (
    <div className="checklist-live-status">
      {isToday ? (
        <span className="store-detail-page__mode-badge store-detail-page__mode-badge--live">
          ● Live
        </span>
      ) : (
        <span className="store-detail-page__mode-badge store-detail-page__mode-badge--historical">
          📋 Historical
        </span>
      )}
    </div>
  );
}

export default ChecklistLiveStatus;
