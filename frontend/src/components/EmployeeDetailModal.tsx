import type { Employee } from '../types/employee';
import { getShiftTimeRange } from '../utils/employeeUtils';
import Modal from './Modal';
import './EmployeeDetailModal.css';

interface EmployeeDetailModalProps {
  employee: Employee | null;
  onClose: () => void;
}

function EmployeeDetailModal({ employee, onClose }: EmployeeDetailModalProps) {
  if (!employee) return null;

  return (
    <Modal
      isOpen={employee !== null}
      onClose={onClose}
      title={employee.name}
      subtitle={employee.empId}
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="employee-detail">
        <span className={`badge ${employee.active ? 'badge--solid' : 'badge--outline'}`}>
          {employee.active ? 'Active' : 'Inactive'}
        </span>

        <dl className="employee-detail__grid">
          <div>
            <dt>Employee ID</dt>
            <dd>{employee.empId}</dd>
          </div>
          <div>
            <dt>Assigned Stores</dt>
            <dd>{employee.stores.length > 0 ? employee.stores.map((store) => store.name).join(', ') : 'No stores'}</dd>
          </div>
          <div>
            <dt>Shift</dt>
            <dd>
              {employee.shift} ({getShiftTimeRange(employee.shift)})
            </dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{employee.employeeType}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{employee.phone}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{employee.email}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{employee.gender}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

export default EmployeeDetailModal;
