import type { GroupedOwner } from './OwnerTable';
import Modal from './Modal';
import './EmployeeDetailModal.css';

interface OwnerDetailModalProps {
  owner: GroupedOwner | null;
  onClose: () => void;
}

function OwnerDetailModal({ owner, onClose }: OwnerDetailModalProps) {
  if (!owner) return null;

  const storeDisplay = owner.activeStore
    ? owner.activeStore.storeName
    : owner.anyStore
      ? `${owner.anyStore.storeName} (Inactive)`
      : 'No store assigned';

  return (
    <Modal
      isOpen={owner !== null}
      onClose={onClose}
      title={owner.ownerName}
      subtitle={owner.adminCode}
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="employee-detail">
        <span className={`badge ${owner.ownerActive ? 'badge--solid' : 'badge--outline'}`}>
          {owner.ownerActive ? 'Active' : 'Inactive'}
        </span>

        <dl className="employee-detail__grid">
          <div>
            <dt>Owner ID</dt>
            <dd>{owner.adminCode}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{owner.ownerEmail}</dd>
          </div>
          <div>
            <dt>Assigned Store</dt>
            <dd>{storeDisplay}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

export default OwnerDetailModal;
