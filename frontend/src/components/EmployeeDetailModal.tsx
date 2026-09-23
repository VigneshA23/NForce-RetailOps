import type { Employee } from '../types/employee';
import { getInitials } from '../utils/initials';
import Modal from './Modal';
import './EmployeeDetailModal.css';

interface EmployeeDetailModalProps {
  employee: Employee | null;
  onClose: () => void;
  // Super Admin's Employees page only -- the owner this employee was created
  // under. Omitted by the owner's own Employees page, where it would always
  // just be "you".
  ownerName?: string;
}

function EmployeeDetailModal({ employee, onClose, ownerName }: EmployeeDetailModalProps) {
  if (!employee) return null;

  return (
    <Modal
      isOpen={employee !== null}
      onClose={onClose}
      title="Employee"
      titleExtra={
        <span className={`emp-detail__status${employee.active ? ' emp-detail__status--active' : ''}`}>
          {employee.active ? 'Active' : 'Inactive'}
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
          {employee.avatarUrl ? (
            <img className="emp-detail__avatar emp-detail__avatar--img" src={employee.avatarUrl} alt="" aria-hidden="true" />
          ) : (
            <span className="emp-detail__avatar" aria-hidden="true">{getInitials(employee.name)}</span>
          )}
          <span className="emp-detail__name">{employee.name}</span>
          <span className="emp-detail__emp-id">{employee.empId}</span>
        </div>

        <dl className="emp-detail__info">
          <div className="emp-detail__row emp-detail__row--stacked">
            <dt>Assigned Stores</dt>
            <dd>
              {employee.stores.length > 0 ? (
                <span className="emp-detail__stores">
                  {employee.stores.map((store) => (
                    <span key={store.id} className="emp-detail__store">{store.name}</span>
                  ))}
                </span>
              ) : (
                <span className="emp-detail__muted">No stores</span>
              )}
            </dd>
          </div>
          {ownerName && (
            <div className="emp-detail__row">
              <dt>Owner</dt>
              <dd>{ownerName}</dd>
            </div>
          )}
          <div className="emp-detail__row">
            <dt>Employment Type</dt>
            <dd>{employee.employeeType}</dd>
          </div>
          <div className="emp-detail__row">
            <dt>Gender</dt>
            <dd>{employee.gender}</dd>
          </div>
          <div className="emp-detail__row">
            <dt>Phone</dt>
            <dd className="emp-detail__accent">{employee.phone}</dd>
          </div>
          <div className="emp-detail__row">
            <dt>Email</dt>
            <dd className="emp-detail__accent">{employee.email}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

export default EmployeeDetailModal;
