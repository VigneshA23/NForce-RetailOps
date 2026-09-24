import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Category } from '../types/category';
import type { AdminTask } from '../types/adminTask';
import { getAllTasks, assignTaskToCategory } from '../api/superAdminTasks';
import { nfToast } from '../utils/toast';
import Modal from './Modal';
import SearchableSelect from './SearchableSelect';
import ButtonDots from './ButtonDots';
import './AssignTasksModal.css';

interface AssignTasksModalProps {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
  // Assigning moves each selected task's categoryId -- the parent re-fetches
  // its category list (for the updated taskCount) once this resolves.
  onAssigned: () => void;
  // "+ Create new task" keeps redirecting to the Tasks page rather than
  // building an inline create form here -- this closes the modal and lets
  // the caller switch tabs.
  onCreateNewTask: () => void;
}

function AssignTasksModal({ isOpen, category, onClose, onAssigned, onCreateNewTask }: AssignTasksModalProps) {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds([]);
    setLoadError(null);
    setIsLoading(true);
    getAllTasks()
      .then((allTasks) => setTasks(allTasks.filter((task) => task.categoryId !== category?.id)))
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Failed to load tasks'))
      .finally(() => setIsLoading(false));
  }, [isOpen, category?.id]);

  async function handleSave() {
    if (!category || selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const selectedTasks = tasks.filter((task) => selectedIds.includes(task.id));
      await Promise.all(selectedTasks.map((task) => assignTaskToCategory(task, category.id)));
      nfToast.success(`${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} moved into "${category.name}".`);
      onAssigned();
      onClose();
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to assign tasks');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Tasks"
      subtitle={category ? `Move existing tasks into "${category.name}". This moves each task out of its current category.` : undefined}
      className="assign-tasks-modal"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`}
            disabled={isSubmitting || selectedIds.length === 0}
            onClick={handleSave}
          >
            {isSubmitting ? <ButtonDots label="Saving" /> : `Assign ${selectedIds.length || ''} Task${selectedIds.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          </button>
        </>
      }
    >
      <div className="assign-tasks-modal__body">
        <SearchableSelect
          id="assign-tasks-select"
          multiple
          options={tasks.map((task) => ({ id: task.id, label: task.name, sublabel: task.categoryName }))}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          placeholder="Select existing tasks…"
          isLoading={isLoading}
          error={loadError}
          emptyMessage="No other tasks exist yet."
          emptyAction={{ label: 'Create a new task instead', onClick: onCreateNewTask }}
        />
        <button type="button" className="assign-tasks-modal__create-link" onClick={onCreateNewTask}>
          <Plus size={14} aria-hidden="true" />
          Create a new task instead
        </button>
      </div>
    </Modal>
  );
}

export default AssignTasksModal;
