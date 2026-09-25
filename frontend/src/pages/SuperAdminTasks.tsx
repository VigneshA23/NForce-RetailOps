import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, CircleDot, Repeat2, Plus } from 'lucide-react';
import { nfToast } from '../utils/toast';
import {
  createTasks,
  deleteTask,
  getAllTasks,
  getApplicableCategories,
  setTaskActive,
  TaskHasHistoryError,
  updateTask,
} from '../api/superAdminTasks';
import { getAllStores } from '../api/superAdminStores';
import { getCategories } from '../api/categories';
import type { Category } from '../types/category';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { AdminTask, AdminTaskFormValues, ScheduleType } from '../types/adminTask';
import { isOneTimeTask, SCHEDULE_TYPE_OPTIONS } from '../utils/adminTaskOptions';
import TaskTable from '../components/TaskTable';
import TaskFormModal from '../components/TaskFormModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import Select from '../components/Select';
import FilterClearButton from '../components/FilterClearButton';
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

// Mirrors the Owner Admin Tasks page (pages/Tasks.tsx) in shape, but read/write
// platform-wide. Both create and edit pick their store scope inline from the
// full platform-wide store list (see TaskFormModal's storeScopeSelectable
// prop); whenever the scope changes, the category list is refetched narrowed
// to what's applicable to it. A Task row always belongs to a single owner, so
// widening an edit's store scope to a store under a different owner doesn't
// move the task there -- the backend fans that out into a new task row for
// that owner instead (see TaskService.updateTaskAsSuperAdmin), which is why
// updateTask()/handleFormSubmit's edit branch reloads the full task list
// afterwards instead of merging a single updated row in place.
function SuperAdminTasks() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<number | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formCategories, setFormCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detailsTask, setDetailsTask] = useState<AdminTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTask | null>(null);
  const [historyConflictTask, setHistoryConflictTask] = useState<AdminTask | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadTasks() {
    setIsLoading(true);
    setLoadError(null);
    getAllTasks()
      .then(setTasks)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    getAllStores().then(setStores).catch(() => {});
  }, []);

  useEffect(() => {
    getCategories().then(setAllCategories).catch(() => {});
  }, []);

  const activeStores = useMemo(() => stores.filter((store) => store.storeActive), [stores]);
  const storeOptionsForPicker = useMemo(
    () => activeStores.map((store) => ({ id: store.storeId, name: store.storeName })),
    [activeStores],
  );

  const storeFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Stores' },
      ...activeStores.map((store) => ({ value: String(store.storeId), label: store.storeName })),
    ],
    [activeStores],
  );

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Categories' },
      ...allCategories.map((category) => ({ value: String(category.id), label: category.name })),
    ],
    [allCategories],
  );

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (normalizedSearch && !task.name.toLowerCase().includes(normalizedSearch)) return false;
      if (storeFilter !== 'ALL' && !task.appliesToAllStores && !task.stores.some((store) => store.id === storeFilter)) return false;
      if (categoryFilter !== 'ALL' && task.categoryId !== categoryFilter) return false;
      if (statusFilter === 'ACTIVE' && !task.active) return false;
      if (statusFilter === 'INACTIVE' && task.active) return false;
      if (scheduleFilter !== 'ALL') {
        const effective = isOneTimeTask(task) ? 'ONE_TIME' : task.scheduleType;
        if (effective !== scheduleFilter) return false;
      }
      return true;
    });
  }, [tasks, search, storeFilter, categoryFilter, statusFilter, scheduleFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, storeFilter, categoryFilter, statusFilter, scheduleFilter]);

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
    if (tasks.some((task) => task.appliesToAllStores)) return activeStores.length;
    const storeIds = new Set<number>();
    tasks.forEach((task) => task.stores.forEach((store) => storeIds.add(store.id)));
    return storeIds.size;
  }, [tasks, activeStores]);

  const summaryText = isLoading
    ? 'Loading tasks...'
    : `${activeTaskCount} active task${activeTaskCount === 1 ? '' : 's'} across ${storeCoverageCount} store${storeCoverageCount === 1 ? '' : 's'}`;

  async function loadCategoriesForScope(scope: { appliesToAllStores: boolean; storeIds: number[] }) {
    if (!scope.appliesToAllStores && scope.storeIds.length === 0) {
      setFormCategories([]);
      setCategoriesError(null);
      return;
    }
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      setFormCategories(await getApplicableCategories(scope));
    } catch (error) {
      setCategoriesError(error instanceof Error ? error.message : 'Failed to load categories for the selected stores');
    } finally {
      setCategoriesLoading(false);
    }
  }

  function openCreateForm() {
    setFormError(null);
    setFormCategories([]);
    setCategoriesError(null);
    setFormModalState({ mode: 'create' });
  }

  // Pre-populates the category list with the task's own existing scope so it
  // isn't empty when the modal first opens; onStoreScopeChange (wired below)
  // takes over and refetches it if the user then changes the store selection.
  function openEditForm(task: AdminTask) {
    setFormError(null);
    setFormModalState({ mode: 'edit', task });
    loadCategoriesForScope({ appliesToAllStores: task.appliesToAllStores, storeIds: task.stores.map((store) => store.id) });
  }

  async function handleFormSubmit(values: AdminTaskFormValues) {
    if (formModalState?.mode === 'edit') {
      const taskId = formModalState.task.id;
      setFormError(null);
      setIsSubmitting(true);
      try {
        const updated = await updateTask(taskId, values);
        // A store-scope change that picks up another owner fans out into a new
        // task row for them (see TaskService.updateTaskAsSuperAdmin), so more
        // than one task can come back here -- reload the full list rather than
        // trying to merge an unknown number of new/changed rows in by hand.
        loadTasks();
        nfToast.success(`"${updated[0].name}" task updated.`);
        setFormModalState(null);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Something went wrong';
        setFormError(msg);
        nfToast.error(msg);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await createTasks(values);
      nfToast.success(`"${values.name}" task added.`);
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
        <StatCard icon={CheckCircle2} label="Active Tasks (All Stores)" value={activeTaskCount} tone="success" />
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
          onClick={openCreateForm}
        >
          <span className="tasks-page__add-label">
            <Plus size={16} />
            Create Task
          </span>
        </SpecularButton>
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks" variant="filter" />
        </div>

        <Select
          className="filter"
          options={storeFilterOptions}
          value={storeFilter === 'ALL' ? 'ALL' : String(storeFilter)}
          onChange={(value) => setStoreFilter(value === 'ALL' ? 'ALL' : Number(value))}
          ariaLabel="Filter by store"
        />

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
        {(storeFilter !== 'ALL' || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || scheduleFilter !== 'ALL') && (
          <FilterClearButton
            onClick={() => { setStoreFilter('ALL'); setCategoryFilter('ALL'); setStatusFilter('ALL'); setScheduleFilter('ALL'); }}
          />
        )}
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
            showStoreColumn
            onRowClick={(task) => setDetailsTask(task)}
            onEdit={openEditForm}
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
        categories={formCategories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        onRetryCategories={() => {}}
        onManageCategories={() => {}}
        stores={storeOptionsForPicker}
        storeScopeSelectable
        onStoreScopeChange={loadCategoriesForScope}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => {
          setFormModalState(null);
          setFormCategories([]);
          setCategoriesError(null);
        }}
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

export default SuperAdminTasks;
