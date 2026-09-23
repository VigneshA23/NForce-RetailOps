import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Check, Plus, Tag } from 'lucide-react';
import type { CategoryFormValues, CategoryStoreOption } from '../types/category';
import { CATEGORY_BADGE_COLORS, DEFAULT_CATEGORY_BADGE_COLOR } from '../utils/categoryBadge';
import Modal from './Modal';
import FormField from './FormField';
import SearchableSelect from './SearchableSelect';
import ButtonDots from './ButtonDots';
import Toggle from './Toggle';
import './CategoryFormModal.css';

interface CategoryFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: CategoryFormValues;
  availableStores: CategoryStoreOption[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => void;
}

// Matches the Task form's default -- starts with nothing selected (no store
// pre-chosen) rather than pre-checking "All Stores", so creating a category
// requires a deliberate choice instead of silently defaulting to every store.
const EMPTY_VALUES: CategoryFormValues = {
  name: '',
  appliesToAllStores: false,
  storeIds: [],
  badgeColor: DEFAULT_CATEGORY_BADGE_COLOR,
  enableImmediately: true,
};

function CategoryFormModal({
  isOpen,
  mode,
  initialValues,
  availableStores,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const [values, setValues] = useState<CategoryFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen) {
      setValues({ ...EMPTY_VALUES, ...initialValues });
      setValidationError(undefined);
    }
  }, [isOpen, initialValues]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (!values.appliesToAllStores && values.storeIds.length === 0) {
      setValidationError('Select at least one store, or choose All Stores');
      return;
    }
    onSubmit({
      ...values,
      name: values.name.trim(),
      // Only meaningful on create; edits leave the category's start date alone.
      enableImmediately: mode === 'create' ? values.enableImmediately : undefined,
    });
  }

  const badgeColor = values.badgeColor ?? DEFAULT_CATEGORY_BADGE_COLOR;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Category' : 'Edit Category'}
      subtitle={
        mode === 'create'
          ? 'Create a functional category to group daily shift checklists & store audits.'
          : 'Update the name, stores and badge color for this category.'
      }
      className="category-form-modal"
      footer={
        <>
          <button type="button" className="btn btn--secondary category-form__cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="category-form"
            className={`btn btn--primary category-form__submit${isSubmitting ? ' btn--loading' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ButtonDots label="Saving" />
            ) : mode === 'create' ? (
              <>
                <Plus size={16} className="category-form__submit-icon" aria-hidden="true" />
                Add Category
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </>
      }
    >
      <form id="category-form" className="category-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Category Name *" htmlFor="category-name" error={validationError}>
          <div className="category-form__input-wrap">
            <Tag size={15} className="category-form__input-icon" aria-hidden="true" />
            <input
              id="category-name"
              className="input"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Opening, Cleaning, Closing"
              autoFocus
            />
          </div>
        </FormField>
        <FormField label="Applies To *" htmlFor="category-stores">
          <div className="category-form__input-wrap category-form__input-wrap--select">
            <Building2 size={15} className="category-form__input-icon" aria-hidden="true" />
            <SearchableSelect
              id="category-stores"
              placeholder="Select store(s)"
              multiple
              options={availableStores.map((store) => ({ id: store.id, label: store.name }))}
              selectedIds={values.storeIds}
              allOption={{
                label: 'All Stores',
                selected: values.appliesToAllStores,
                onToggle: () => setValues((current) => ({ ...current, appliesToAllStores: !current.appliesToAllStores, storeIds: [] })),
              }}
              onChange={(ids) => {
                // Checking every individual store by hand is the same intent as
                // checking "All Stores" -- promote to it so the category also
                // covers stores added later, not just today's full list.
                const everyStoreSelected = availableStores.length > 0 && availableStores.every((store) => ids.includes(store.id));
                setValues((current) => ({
                  ...current,
                  ...(everyStoreSelected
                    ? { appliesToAllStores: true, storeIds: [] }
                    : { appliesToAllStores: false, storeIds: ids }),
                }));
              }}
            />
          </div>
        </FormField>

        <div className="category-form__badge">
          <div className="category-form__badge-header">
            <span className="form-field__label" id="category-badge-label">Badge Color</span>
            <span className="category-form__icon-preview">
              Category Icon
              <span className={`category-form__icon-tile category-form__icon-tile--${badgeColor}`} aria-hidden="true">
                <Tag size={14} />
              </span>
            </span>
          </div>
          <div className="category-form__swatches" role="radiogroup" aria-labelledby="category-badge-label">
            {CATEGORY_BADGE_COLORS.map((color) => {
              const selected = color.value === badgeColor;
              return (
                <button
                  key={color.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={color.label}
                  title={color.label}
                  className={`category-form__swatch category-form__swatch--${color.value}${selected ? ' category-form__swatch--selected' : ''}`}
                  onClick={() => setValues((current) => ({ ...current, badgeColor: color.value }))}
                >
                  {selected && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        {mode === 'create' && (
          <div className="category-form__enable">
            <div className="category-form__enable-text">
              <span className="category-form__enable-title">Enable Immediately</span>
              <span className="category-form__enable-hint">
                {values.enableImmediately
                  ? 'Category becomes visible to shift staff right away'
                  : 'Hidden from today’s checklist; goes live from tomorrow'}
              </span>
            </div>
            <Toggle
              checked={values.enableImmediately ?? true}
              onChange={(checked) => setValues((current) => ({ ...current, enableImmediately: checked }))}
              label="Enable Immediately"
            />
          </div>
        )}

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default CategoryFormModal;
