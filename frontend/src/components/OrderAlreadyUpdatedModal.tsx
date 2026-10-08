import Modal from './Modal';

interface OrderAlreadyUpdatedModalProps {
  // The backend's conflict message, e.g. "This item has already been updated
  // by Super Admin. It is now marked as Ordered. ..."
  message: string;
  onClose: () => void;
}

// Shown when a status change is rejected because someone else (Owner/Admin or
// Super Admin) already moved the entry -- the caller's view was stale, so the
// change was not applied and the list has been refreshed behind this popup.
function OrderAlreadyUpdatedModal({ message, onClose }: OrderAlreadyUpdatedModalProps) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Already updated"
      centered
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          OK
        </button>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

export default OrderAlreadyUpdatedModal;
