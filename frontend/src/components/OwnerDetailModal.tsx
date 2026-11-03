import type { GroupedOwner } from './OwnerTable';
import { getInitials } from '../utils/initials';
import Modal from './Modal';
import './EmployeeDetailModal.css';

interface OwnerDetailModalProps {
  owner: GroupedOwner | null;
  onClose: () => void;
}

// Same layout as EmployeeDetailModal (shares its .emp-detail* styles) so the
// two "view details" popups look identical.
function OwnerDetailModal({ owner, onClose }: OwnerDetailModalProps) {
  if (!owner) return null;

  const storeName = owner.activeStore
    ? owner.activeStore.storeName
    : owner.ownerActive && owner.anyStore
      ? `${owner.anyStore.storeName} (Inactive)`
      : null;

  return (
    <Modal
      isOpen={owner !== null}
      onClose={onClose}
      title="Owner"
      titleExtra={
        <span className={`emp-detail__status${owner.ownerActive ? ' emp-detail__status--active' : ''}`}>
          {owner.ownerActive ? 'Active' : 'Inactive'}
        </span>
      }
      className="emp-detail-modal"
      footer={
        <button type="button" className="btn btn--secondary emp-detail__close" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="emp-detail">
        <div className="emp-detail__profile">
          {owner.avatarUrl ? (
            <img className="emp-detail__avatar emp-detail__avatar--img" src={owner.avatarUrl} alt="" aria-hidden="true" />
          ) : (
            <span className="emp-detail__avatar" aria-hidden="true">{getInitials(owner.ownerName)}</span>
          )}
          <span className="emp-detail__name">{owner.ownerName}</span>
          <span className="emp-detail__emp-id">{owner.adminCode}</span>
        </div>

        <dl className="emp-detail__info">
          <div className="emp-detail__row emp-detail__row--stacked">
            <dt>Assigned Store</dt>
            <dd>
              {storeName ? (
                <span className="emp-detail__stores">
                  <span className="emp-detail__store">{storeName}</span>
                </span>
              ) : (
                <span className="emp-detail__muted">No store assigned</span>
              )}
            </dd>
          </div>
          <div className="emp-detail__row">
            <dt>Email</dt>
            <dd className="emp-detail__accent">{owner.ownerEmail}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

export default OwnerDetailModal;
