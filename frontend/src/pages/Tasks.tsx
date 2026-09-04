import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, CircleDot, Repeat2, Plus } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { createTask, deleteTask, getTasks, setTaskActive, TaskHasHistoryError, updateTask } from '../api/ownerTasks';
import type { Category } from '../types/category';
import type { OwnerStore } from '../types/ownerStore';
import type { AdminTask, AdminTaskFormValues, ScheduleType } from '../types/adminTask';
import { SCHEDULE_TYPE_OPTIONS } from '../utils/adminTaskOptions';
import TaskTable from '../components/TaskTable';
import TaskFormModal from '../components/TaskFormModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import Select from '../components/Select';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './Tasks.css';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const SCHEDULE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Schedules' },
  ...SCHEDULE_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type FormModalState = { mode: 'create' } | { mode: 'edit'; task: AdminTask } | null;

const PAGE_SIZE = 10;

interface TasksProps {
  onNavigateToCategories?: () => void;
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  onRetryCategories: () => void;
  stores: OwnerStore[];
}

function Tasks({
  onNavigateToCategories,
  categories,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  stores,
}: TasksProps) {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detailsTask, setDetailsTask] = useState<AdminTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTask | null>(null);
  const [historyConflictTask, setHistoryConflictTask] = useState<AdminTask | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadTasks() {
    setIsLoading(true);
    setLoadError(null);
    getTasks()
      .then(setTasks)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadTasks();
  }, []);

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Categories' },
      ...categories.map((category) => ({ value: String(category.id), label: category.name })),
    ],
    [categories],
  );

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (normalizedSearch && !task.name.toLowerCase().includes(normalizedSearch)) return false;
      if (categoryFilter !== 'ALL' && task.categoryId !== categoryFilter) return false;
      if (statusFilter === 'ACTIVE' && !task.active) return false;
      if (statusFilter === 'INACTIVE' && task.active) return false;
      if (scheduleFilter !== 'ALL' && task.scheduleType !== scheduleFilter) return false;
      return true;
    });
  }, [tasks, search, categoryFilter, statusFilter, scheduleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, scheduleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedTasks = filteredTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeTaskCount = useMemo(() => tasks.filter((task) => task.active).length, [tasks]);

  const singleCompletionCount = useMemo(
    () => tasks.filter((task) => task.active && task.completionType === 'SINGLE').length,
    [tasks],
  );

  const multipleCompletionCount = useMemo(
    () => tasks.filter((task) => task.active && task.completionType === 'MULTIPLE').length,
    [tasks],
  );

  const storeCoverageCount = useMemo(() => {
    if (tasks.some((task) => task.appliesToAllStores)) return stores.length;
    const storeIds = new Set<number>();
    tasks.forEach((task) => task.stores.forEach((store) => storeIds.add(store.id)));
    return storeIds.size;
  }, [tasks, stores]);

  const summaryText = isLoading
    ? 'Loading tasks...'
    : `${activeTaskCount} active task${activeTaskCount === 1 ? '' : 's'} across ${storeCoverageCount} store${storeCoverageCount === 1 ? '' : 's'}`;

  async function handleFormSubmit(values: AdminTaskFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formModalState?.mode === 'edit') {
        await updateTask(formModalState.task.id, values);
        nfToast.success(`"${formModalState.task.name}" task updated.`);
      } else {
        await createTask(values);
        nfToast.success(`"${values.name}" task added.`);
      }
      // Re-fetch from the backend rather than splicing the response into local state --
      // the list must reflect the backend's category + Display Order sort, not insertion
      // order or in-place position.
      loadTasks();
      setFormModalState(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteTask(deleteTarget.id);
      const deletedName = deleteTarget.name;
      setTasks((current) => current.filter((task) => task.id !== deleteTarget.id));
      setDeleteTarget(null);
      nfToast.success(`"${deletedName}" task deleted.`);
    } catch (error) {
      if (error instanceof TaskHasHistoryError) {
        const conflicted = deleteTarget;
        setDeleteTarget(null);
        setHistoryConflictTask(conflicted);
        return;
      }
      setDeleteTarget(null);
      setActionError(error instanceof Error ? error.message : 'Failed to delete task');
    }
  }

  async function handleToggleStatus(task: AdminTask) {
    setActionError(null);
    const nextActive = !task.active;
    // Optimistic update so the toggle responds immediately; reverted below on failure.
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, active: nextActive } : t)));
    try {
      const updated = await setTaskActive(task.id, nextActive);
      setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
      nfToast.success(`"${updated.name}" task ${updated.active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, active: task.active } : t)));
      const msg = error instanceof Error ? error.message : 'Failed to update task status';
      setActionError(msg);
      nfToast.error(msg);
    }
  }

  async function handleDeactivateInsteadOfDelete() {
    if (!historyConflictTask) return;
    setActionError(null);
    try {
      const updated = await setTaskActive(historyConflictTask.id, false);
      setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
      const deactivatedName = updated.name;
      setHistoryConflictTask(null);
      nfToast.success(`"${deactivatedName}" task deactivated.`);
    } catch (error) {
      setHistoryConflictTask(null);
      const msg = error instanceof Error ? error.message : 'Failed to deactivate task';
      setActionError(msg);
      nfToast.error(msg);
    }
  }

  return (
    <div className="tasks-page">
      <div className="stat-card-row">
        <StatCard icon={ClipboardList} label="Total Tasks" value={tasks.length} tone="primary" />
        <StatCard icon={CheckCircle2} label="Active Tasks" value={activeTaskCount} tone="success" />
        <StatCard icon={CircleDot} label="Single Completion" value={singleCompletionCount} tone="info" />
        <StatCard icon={Repeat2} label="Multiple Completions" value={multipleCompletionCount} tone="warning" />
      </div>

      <div className="tasks-page__header">
        <p className="tasks-page__summary">{summaryText}</p>

        <SpecularButton
          size="sm"
          radius={999}
          tint="var(--color-badge-solid-bg)"
          tintOpacity={1}
          textColor="var(--color-badge-solid-text)"
          lineColor="#e11d33"
          baseColor="#e4e4e7"
          followMouse
          proximity={180}
          onClick={() => {
            setFormError(null);
            setFormModalState({ mode: 'create' });
          }}
        >
          <span className="tasks-page__add-label">
            <Plus size={16} />
            Create Task
          </span>
        </SpecularButton>
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks" />
        </div>

        <Select
          className="filter"
          options={categoryFilterOptions}
          value={categoryFilter === 'ALL' ? 'ALL' : String(categoryFilter)}
          onChange={(value) => setCategoryFilter(value === 'ALL' ? 'ALL' : Number(value))}
          ariaLabel="Filter by category"
        />

        <Select
          className="filter filter--narrow"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as StatusFilter)}
          ariaLabel="Filter by status"
        />

        <Select
          className="filter"
          options={SCHEDULE_FILTER_OPTIONS}
          value={scheduleFilter}
          onChange={(value) => setScheduleFilter(value as ScheduleType | 'ALL')}
          ariaLabel="Filter by schedule"
        />
      </div>

      {actionError && <div className="tasks-page__error">{actionError}</div>}

      {loadError ? (
        <div className="tasks-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={loadTasks}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <TaskTable
            tasks={pagedTasks}
            isLoading={isLoading}
            onRowClick={(task) => setDetailsTask(task)}
            onEdit={(task) => {
              setFormError(null);
              setFormModalState({ mode: 'edit', task });
            }}
            onDelete={(task) => {
              setActionError(null);
              setDeleteTarget(task);
            }}
            onToggleStatus={handleToggleStatus}
          />
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            totalItems={filteredTasks.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <TaskFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialTask={formModalState?.mode === 'edit' ? formModalState.task : undefined}
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        onRetryCategories={onRetryCategories}
        onManageCategories={() => onNavigateToCategories?.()}
        stores={stores}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
      />

      <TaskDetailsModal
        task={detailsTask}
        isOpen={detailsTask !== null}
        onClose={() => setDetailsTask(null)}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Task?"
        message="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={historyConflictTask !== null}
        title="Cannot Delete Task"
        message="This task has existing completion history and cannot be deleted. Deactivate the task instead to preserve historical records."
        confirmLabel="Deactivate Task"
        danger={false}
        onConfirm={handleDeactivateInsteadOfDelete}
        onCancel={() => setHistoryConflictTask(null)}
      />
    </div>
  );
}

export default Tasks;
