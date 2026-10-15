import Modal from './Modal';

interface MissedEndOfDayBlockModalProps {
  isOpen: boolean;
  itemName: string;
  // The business day whose End of Day is missing (YYYY-MM-DD).
  date: string | null;
  // Opens the Notifications page, where the missing End of Day is answered.
  onOpenNotifications: () => void;
  onClose: () => void;
}

// Shown when someone tries to save Start of Day for an item whose End of Day
// from yesterday was never counted or explained.
function MissedEndOfDayBlockModal({ isOpen, itemName, date, onOpenNotifications, onClose }: MissedEndOfDayBlockModalProps) {
  const day = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : 'yesterday';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      centered
      title="Yesterday's End of Day is missing"
      subtitle={`${itemName} was counted at Start of Day on ${day} but not at End of Day. Respond to that End of Day first, then you can take today's Start of Day.`}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn--primary" onClick={onOpenNotifications}>
            Respond in notifications
          </button>
        </>
      }
    >
      <p>
        Open your notifications and answer the &quot;End of Day missing&quot; notice: enter the count, or say why it
        could not be counted. Your admin can answer it too, and only the first response is kept.
      </p>
    </Modal>
  );
}

export default MissedEndOfDayBlockModal;
