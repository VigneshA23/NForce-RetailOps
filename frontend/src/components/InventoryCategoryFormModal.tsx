import { useEffect, useState, type FormEvent } from 'react';
import { Tag } from 'lucide-react';
import type { InventoryCategoryFormValues, InventoryCategoryStoreOption } from '../types/inventoryCategory';
import Modal from './Modal';
import FormField from './FormField';
import SearchableSelect from './SearchableSelect';
import ButtonDots from './ButtonDots';
import './SupplierFormModal.css';

interface InventoryCategoryFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: InventoryCategoryFormValues;
  availableStores?: InventoryCategoryStoreOption[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryCategoryFormValues) => void;
}

const EMPTY_VALUES: InventoryCategoryFormValues = {
  name: '',
  appliesToAllStores: false,
  storeIds: [],
};

// Mirrors SupplierFormModal's extended (Super Admin) form, minus the
// contact/location fields a category has no use for.
function InventoryCategoryFormModal({
  isOpen,
  mode,
  initialValues,
  availableStores = [],
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: InventoryCategoryFormModalProps) {
  const [values, setValues] = useState<InventoryCategoryFormValues>({ ...EMPTY_VALUES, ...initialValues });
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
    onSubmit({ ...values, name: values.name.trim() });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Category' : 'Edit Category'}
      subtitle={
        mode === 'create'
          ? 'Add a category to the platform directory and assign it to the stores that use it.'
          : 'Update the name and stores for this category.'
      }
      className="supplier-form-modal"
      footer={
        <>
          <button type="button" className="btn btn--secondary supplier-form__cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="inventory-category-form"
            className={`btn btn--primary supplier-form__submit${isSubmitting ? ' btn--loading' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ButtonDots label="Saving" /> : mode === 'create' ? 'Add Category' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="inventory-category-form" className="supplier-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Category Name" htmlFor="inventory-category-name" error={validationError}>
          <div className="supplier-form__input-wrap">
            <Tag size={15} className="supplier-form__input-icon" aria-hidden="true" />
            <input
              id="inventory-category-name"
              className="input"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Dairy, Packaging"
              autoFocus
            />
          </div>
        </FormField>

        <FormField label="Select Store" htmlFor="inventory-category-stores">
          <div className="supplier-form__input-wrap supplier-form__input-wrap--select">
            <SearchableSelect
              id="inventory-category-stores"
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

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default InventoryCategoryFormModal;
