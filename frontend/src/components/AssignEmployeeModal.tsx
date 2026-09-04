import { useEffect, useState } from 'react';
import { nfToast } from '../utils/toast';
import { assignEmployeeToMyStore, getEmployeeDirectory, unassignEmployeeFromMyStore } from '../api/employees';
import type { EmployeeDirectoryEntry } from '../types/employee';
import Modal from './Modal';
import SearchInput from './SearchInput';
import './AssignEmployeeModal.css';

interface AssignEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after any successful assign/unassign, so the caller can refresh its own employee list. */
  onAssignmentChange: () => void;
}

// Employees are created by the Super Admin with no store -- this is how an
// Owner picks one up (or lets one go) for their own store. An employee
// already working at another owner's store still shows up here and can be
// added to this store too.
function AssignEmployeeModal({ isOpen, onClose, onAssignmentChange }: AssignEmployeeModalProps) {
  const [entries, setEntries] = useState<EmployeeDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    getEmployeeDirectory()
      .then(setEntries)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      load();
    }
  }, [isOpen]);

  const query = search.trim().toLowerCase();
  const filteredEntries = query
    ? entries.filter((entry) =>
        [entry.name, entry.empId, entry.email, entry.phone].some((field) => field.toLowerCase().includes(query)),
      )
    : entries;

  async function handleToggle(entry: EmployeeDirectoryEntry) {
    setPendingId(entry.id);
    try {
      const updated = entry.assignedToMyStore
        ? await unassignEmployeeFromMyStore(entry.id)
        : await assignEmployeeToMyStore(entry.id);
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? { ...item, stores: updated.stores, assignedToMyStore: !entry.assignedToMyStore }
            : item,
        ),
      );
      nfToast.success(
        entry.assignedToMyStore ? `${entry.name} removed from your store.` : `${entry.name} assigned to your store.`,
      );
      onAssignmentChange();
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Employee" size="lg">
      <div className="assign-employee-modal">
        <SearchInput value={search} onChange={setSearch} placeholder="Search employees by name, email, or phone" />

        {loadError ? (
          <div className="assign-employee-modal__error">
            {loadError}
            <button type="button" className="btn btn--secondary" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <ul className="assign-employee-modal__list">
            {filteredEntries.map((entry) => (
              <li key={entry.id} className="assign-employee-modal__row">
                <div className="assign-employee-modal__info">
                  <span className="assign-employee-modal__name">{entry.name}</span>
                  <span className="assign-employee-modal__meta">
                    {entry.empId} · {entry.phone}
                  </span>
                  <span className="assign-employee-modal__stores">
                    {entry.stores.length > 0 ? entry.stores.map((store) => store.name).join(', ') : 'No stores yet'}
                  </span>
                </div>
                <button
                  type="button"
                  className={`btn ${entry.assignedToMyStore ? 'btn--secondary' : 'btn--primary'}`}
                  disabled={pendingId === entry.id}
                  onClick={() => handleToggle(entry)}
                >
                  {pendingId === entry.id ? 'Saving...' : entry.assignedToMyStore ? 'Remove from my store' : 'Assign to my store'}
                </button>
              </li>
            ))}
            {!isLoading && filteredEntries.length === 0 && (
              <li className="assign-employee-modal__empty">
                {entries.length === 0 ? 'No employees yet.' : 'No employees match your search.'}
              </li>
            )}
            {isLoading && <li className="assign-employee-modal__empty">Loading employees...</li>}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default AssignEmployeeModal;
