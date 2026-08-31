import { useEffect, useState, type FormEvent } from 'react';
import type { Category } from '../types/category';
import type { OwnerStore } from '../types/ownerStore';
import type { AdminTask, AdminTaskFormValues, CompletionType, DayCode, ResponseType, ScheduleType } from '../types/adminTask';
import { emptyTaskFormValues, validateTaskForm, type AdminTaskFormErrors } from '../utils/adminTaskValidation';
import { COMPLETION_TYPE_OPTIONS, DAY_OPTIONS, RESPONSE_TYPE_OPTIONS, SCHEDULE_TYPE_OPTIONS } from '../utils/adminTaskOptions';
import Modal from './Modal';
import FormField from './FormField';
import SearchableSelect from './SearchableSelect';
import './TaskFormModal.css';

interface TaskFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialTask?: AdminTask;
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  onRetryCategories: () => void;
  onManageCategories: () => void;
  stores: OwnerStore[];
  storesLoading: boolean;
  storesError: string | null;
  onRetryStores: () => void;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: AdminTaskFormValues) => void;
}

function toFormValues(task: AdminTask): AdminTaskFormValues {
  return {
    name: task.name,
    categoryId: task.categoryId,
    displayOrder: String(task.displayOrder),
    appliesToAllStores: task.appliesToAllStores,
    storeIds: task.stores.map((store) => store.id),
    responseType: task.responseType,
    responseNote: task.responseType === 'TEXT' ? (task.responseNote ?? '') : '',
    numericUnit: task.numericUnit ?? '',
    numericMin: task.numericMin != null ? String(task.numericMin) : '',
    numericMax: task.numericMax != null ? String(task.numericMax) : '',
    completionType: task.completionType,
    scheduleType: task.scheduleType,
    selectedDays: task.selectedDays,
    startDate: task.startDate,
    endDate: task.endDate ?? '',
    active: task.active,
  };
}

function TaskFormModal({
  isOpen,
  mode,
  initialTask,
  categories,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  onManageCategories,
  stores,
  storesLoading,
  storesError,
  onRetryStores,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const [values, setValues] = useState<AdminTaskFormValues>(emptyTaskFormValues());
  const [errors, setErrors] = useState<AdminTaskFormErrors>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialTask ? toFormValues(initialTask) : emptyTaskFormValues());
      setErrors({});
    }
  }, [isOpen, initialTask]);

  function updateField<K extends keyof AdminTaskFormValues>(field: K, value: AdminTaskFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleResponseTypeChange(responseType: ResponseType) {
    setValues((current) => ({
      ...current,
      responseType,
      responseNote: '',
      numericUnit: '',
      numericMin: '',
      numericMax: '',
    }));
  }

  function handleCompletionTypeChange(completionType: CompletionType) {
    updateField('completionType', completionType);
  }

  function handleScheduleTypeChange(scheduleType: ScheduleType) {
    setValues((current) => ({
      ...current,
      scheduleType,
      selectedDays: scheduleType === 'SELECTED_DAYS' ? current.selectedDays : [],
    }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateTaskForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(values);
  }

  function toggleSelectedDay(day: DayCode) {
    const next = values.selectedDays.includes(day)
      ? values.selectedDays.filter((existing) => existing !== day)
      : [...values.selectedDays, day];
    updateField('selectedDays', next);
  }

  const responseNoteLength = values.responseNote.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={mode === 'edit' ? 'Edit Task' : 'Create Task'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Task'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} noValidate className="task-form">
        <section className="task-form__section">
          <h3 className="task-form__heading">Basic Information</h3>

          <FormField label="Task Name *" htmlFor="task-name" error={errors.name}>
            <input
              id="task-name"
              className="input"
              value={values.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Enter task name"
              autoFocus
            />
          </FormField>
        </section>

        <section className="task-form__section">
          <h3 className="task-form__heading">Category</h3>
          <FormField label="Category *" htmlFor="task-category" error={errors.categoryId}>
            {!categoriesLoading && !categoriesError && categories.length === 0 ? (
              <div className="task-form__empty-state">
                No categories yet.
                <button type="button" className="btn btn--secondary" onClick={onManageCategories}>
                  Manage Categories
                </button>
              </div>
            ) : (
              <SearchableSelect
                id="task-category"
                placeholder="Select Category"
                options={categories.map((category) => ({ id: category.id, label: category.name }))}
                selectedIds={values.categoryId != null ? [values.categoryId] : []}
                onChange={(ids) => updateField('categoryId', ids[0] ?? null)}
                isLoading={categoriesLoading}
                error={categoriesError}
                onRetry={onRetryCategories}
              />
            )}
          </FormField>

          <FormField
            label="Display Order (optional)"
            htmlFor="task-display-order"
            error={errors.displayOrder}
          >
            <input
              id="task-display-order"
              type="number"
              className="input"
              value={values.displayOrder}
              onChange={(event) => updateField('displayOrder', event.target.value)}
              placeholder="Auto (added to end of category)"
            />
          </FormField>
          <p className="task-form__hint">Controls the order this task appears in within its category on the Employee Checklist.</p>
        </section>

        <section className="task-form__section">
          <h3 className="task-form__heading">Stores</h3>
          <FormField label="Applicable Stores *" htmlFor="task-stores" error={errors.storeIds}>
            <SearchableSelect
              id="task-stores"
              multiple
              placeholder="Search and select stores"
              options={stores.map((store) => ({ id: store.id, label: store.name }))}
              selectedIds={values.storeIds}
              onChange={(ids) => updateField('storeIds', ids)}
              isLoading={storesLoading}
              error={storesError}
              onRetry={onRetryStores}
              emptyMessage="No stores yet."
              emptyAction={{ label: 'Manage Stores', onClick: onManageCategories }}
              allOption={{
                label: 'All Stores',
                selected: values.appliesToAllStores,
                onToggle: () => {
                  updateField('appliesToAllStores', !values.appliesToAllStores);
                  if (!values.appliesToAllStores) updateField('storeIds', []);
                },
              }}
            />
          </FormField>
        </section>

        <section className="task-form__section">
          <h3 className="task-form__heading">Response</h3>
          <FormField label="Response Type *" htmlFor="task-response-type" error={errors.responseType}>
            <select
              id="task-response-type"
              className="select"
              value={values.responseType ?? ''}
              onChange={(event) => handleResponseTypeChange(event.target.value as ResponseType)}
            >
              <option value="" disabled>
                Select Response Type
              </option>
              {RESPONSE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          {values.responseType === 'NUMERIC' && (
            <div className="task-form__conditional task-form__grid-3">
              <FormField label="Unit" htmlFor="task-numeric-unit">
                <input
                  id="task-numeric-unit"
                  className="input"
                  value={values.numericUnit}
                  onChange={(event) => updateField('numericUnit', event.target.value)}
                  placeholder="°F"
                />
              </FormField>
              <FormField label="Minimum Value" htmlFor="task-numeric-min" error={errors.numericMin}>
                <input
                  id="task-numeric-min"
                  type="number"
                  className="input"
                  value={values.numericMin}
                  onChange={(event) => updateField('numericMin', event.target.value)}
                  placeholder="32"
                />
              </FormField>
              <FormField label="Maximum Value" htmlFor="task-numeric-max" error={errors.numericMax}>
                <input
                  id="task-numeric-max"
                  type="number"
                  className="input"
                  value={values.numericMax}
                  onChange={(event) => updateField('numericMax', event.target.value)}
                  placeholder="40"
                />
              </FormField>
            </div>
          )}

          {values.responseType === 'TEXT' && (
            <div className="task-form__conditional">
              <FormField label="Short Text (optional)" htmlFor="task-response-note-text" error={errors.responseNote}>
                <input
                  id="task-response-note-text"
                  className="input"
                  value={values.responseNote}
                  maxLength={25}
                  onChange={(event) => updateField('responseNote', event.target.value.slice(0, 25))}
                  placeholder="e.g. Temperature OK"
                />
              </FormField>
              <p className="task-form__hint task-form__char-count">{Math.min(responseNoteLength, 25)} / 25</p>
            </div>
          )}
        </section>

        <section className="task-form__section">
          <h3 className="task-form__heading">Completion</h3>
          <FormField label="Completion Type *" htmlFor="task-completion-type" error={errors.completionType}>
            <select
              id="task-completion-type"
              className="select"
              value={values.completionType ?? ''}
              onChange={(event) => handleCompletionTypeChange(event.target.value as CompletionType)}
            >
              <option value="" disabled>
                Select Completion Type
              </option>
              {COMPLETION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </section>

        <section className="task-form__section">
          <h3 className="task-form__heading">Schedule</h3>
          <FormField label="Schedule *" htmlFor="task-schedule-type" error={errors.scheduleType}>
            <select
              id="task-schedule-type"
              className="select"
              value={values.scheduleType ?? ''}
              onChange={(event) => handleScheduleTypeChange(event.target.value as ScheduleType)}
            >
              <option value="" disabled>
                Select Schedule
              </option>
              {SCHEDULE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          {values.scheduleType === 'SELECTED_DAYS' && (
            <div className="task-form__conditional">
              <span className="task-form__conditional-label">Select Days *</span>
              <div className="task-form__days">
                {DAY_OPTIONS.map((day) => (
                  <label key={day.value} className="task-form__day">
                    <input
                      type="checkbox"
                      checked={values.selectedDays.includes(day.value)}
                      onChange={() => toggleSelectedDay(day.value)}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              {errors.selectedDays && <span className="form-field__error">{errors.selectedDays}</span>}
            </div>
          )}
        </section>

        <section className="task-form__section">
          <h3 className="task-form__heading">Date Range</h3>
          <div className="task-form__grid-2">
            <FormField label="Start Date *" htmlFor="task-start-date" error={errors.startDate}>
              <input
                id="task-start-date"
                type="date"
                className="input"
                value={values.startDate}
                onChange={(event) => updateField('startDate', event.target.value)}
              />
            </FormField>
            <FormField label="End Date" htmlFor="task-end-date" error={errors.endDate}>
              <input
                id="task-end-date"
                type="date"
                className="input"
                value={values.endDate}
                onChange={(event) => updateField('endDate', event.target.value)}
              />
            </FormField>
          </div>
          <p className="task-form__hint">Leave End Date empty for an ongoing task until it's deactivated.</p>
        </section>

        <section className="task-form__section">
          <h3 className="task-form__heading">Status</h3>
          <FormField label="Status" htmlFor="task-status">
            <select
              id="task-status"
              className="select"
              value={values.active ? 'ACTIVE' : 'INACTIVE'}
              onChange={(event) => updateField('active', event.target.value === 'ACTIVE')}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </FormField>
        </section>

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default TaskFormModal;
