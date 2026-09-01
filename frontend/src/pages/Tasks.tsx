import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, CircleDot, Repeat2, Plus } from 'lucide-react';
import { getCategories } from '../api/categories';
import { getStores } from '../api/ownerStores';
import { createTask, deleteTask, getTasks, setTaskActive, TaskHasHistoryError, updateTask } from '../api/ownerTasks';
import type { Category } from '../types/category';
import type { OwnerStore } from '../types/ownerStore';
import type { AdminTask, AdminTaskFormValues, ScheduleType } from '../types/adminTask';
import { SCHEDULE_TYPE_OPTIONS } from '../utils/adminTaskOptions';
import TaskTable from '../components/TaskTable';
import TaskFormModal from '../components/TaskFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './Tasks.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type FormModalState = { mode: 'create' } | { mode: 'edit'; task: AdminTask } | null;

const PAGE_SIZE = 10;

interface TasksProps {
  onNavigateToCategories?: () => void;
}

function Tasks({ onNavigateToCategories }: TasksProps) {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'ALL'>('ALL');
  const [storeFilter, setStoreFilter] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminTask | null>(null);
  const [historyConflictTask, setHistoryConflictTask] = useState<AdminTask | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  function loadTasks() {
    setIsLoading(true);
    setLoadError(null);
    getTasks()
      .then(setTasks)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError(null);
    getCategories()
      .then(setCategories)
      .catch((error: Error) => setCategoriesError(error.message))
      .finally(() => setCategoriesLoading(false));
  }

  function loadStores() {
    setStoresLoading(true);
    setStoresError(null);
    getStores()
      .then(setStores)
      .catch((error: Error) => setStoresError(error.message))
      .finally(() => setStoresLoading(false));
  }

  useEffect(() => {
    loadTasks();
    loadCategories();
    loadStores();
  }, []);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (normalizedSearch && !task.name.toLowerCase().includes(normalizedSearch)) return false;
      if (categoryFilter !== 'ALL' && task.categoryId !== categoryFilter) return false;
      if (storeFilter !== 'ALL' && !task.appliesToAllStores && !task.stores.some((store) => store.id === storeFilter)) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && !task.active) return false;
      if (statusFilter === 'INACTIVE' && task.active) return false;
      if (scheduleFilter !== 'ALL' && task.scheduleType !== scheduleFilter) return false;
      return true;
    });
  }, [tasks, search, categoryFilter, storeFilter, statusFilter, scheduleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, storeFilter, statusFilter, scheduleFilter]);

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
      } else {
        await createTask(values);
      }
      // Re-fetch from the backend rather than splicing the response into local state --
      // the list must reflect the backend's category + Display Order sort, not insertion
      // order or in-place position.
      loadTasks();
      setFormModalState(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteTask(deleteTarget.id);
      setTasks((current) => current.filter((task) => task.id !== deleteTarget.id));
      setDeleteTarget(null);
      setSuccessMessage('Task deleted successfully.');
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

  async function handleDeactivateInsteadOfDelete() {
    if (!historyConflictTask) return;
    setActionError(null);
    try {
      const updated = await setTaskActive(historyConflictTask.id, false);
      setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
      setHistoryConflictTask(null);
    } catch (error) {
      setHistoryConflictTask(null);
      setActionError(error instanceof Error ? error.message : 'Failed to deactivate task');
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

        <select
          className="select filter"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))}
        >
          <option value="ALL">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          className="select filter"
          value={storeFilter}
          onChange={(event) => setStoreFilter(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))}
        >
          <option value="ALL">All Stores</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>

        <select
          className="select filter filter--narrow"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <select
          className="select filter"
          value={scheduleFilter}
          onChange={(event) => setScheduleFilter(event.target.value as ScheduleType | 'ALL')}
        >
          <option value="ALL">All Schedules</option>
          {SCHEDULE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {successMessage && <div className="tasks-page__success">{successMessage}</div>}
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
            onEdit={(task) => {
              setFormError(null);
              setFormModalState({ mode: 'edit', task });
            }}
            onDelete={(task) => {
              setActionError(null);
              setDeleteTarget(task);
            }}
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
        onRetryCategories={loadCategories}
        onManageCategories={() => onNavigateToCategories?.()}
        stores={stores}
        storesLoading={storesLoading}
        storesError={storesError}
        onRetryStores={loadStores}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
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
