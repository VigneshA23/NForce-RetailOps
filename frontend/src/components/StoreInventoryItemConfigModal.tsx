import { useEffect, useState, type FormEvent } from 'react';
import type { StoreInventoryItem, StoreInventoryItemConfigFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';

interface StoreInventoryItemConfigModalProps {
  isOpen: boolean;
  item: StoreInventoryItem | null;
  suppliers: Supplier[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: StoreInventoryItemConfigFormValues) => void;
}

function StoreInventoryItemConfigModal({
  isOpen,
  item,
  suppliers,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: StoreInventoryItemConfigModalProps) {
  const [values, setValues] = useState<StoreInventoryItemConfigFormValues>({
    minWeekday: '',
    minWeekend: '',
    preferredSupplierId: null,
  });
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen && item) {
      setValues({
        minWeekday: item.minWeekday != null ? String(item.minWeekday) : '',
        minWeekend: item.minWeekend != null ? String(item.minWeekend) : '',
        preferredSupplierId: item.preferredSupplierId,
      });
      setValidationError(undefined);
    }
  }, [isOpen, item]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (values.minWeekday.trim() !== '' && Number(values.minWeekday) < 0) {
      setValidationError('Minimum weekday quantity cannot be negative');
      return;
    }
    if (values.minWeekend.trim() !== '' && Number(values.minWeekend) < 0) {
      setValidationError('Minimum weekend quantity cannot be negative');
      return;
    }
    onSubmit(values);
  }

  const supplierOptions = [
    { value: '', label: 'No preferred supplier' },
    ...suppliers.filter((s) => s.active).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? `Configure ${item.itemName}` : 'Configure Item'}
      subtitle="Set minimum stock thresholds and a preferred supplier for this store."
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="store-inventory-item-config-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="store-inventory-item-config-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Minimum Weekday Quantity" htmlFor="min-weekday">
          <input
            id="min-weekday"
            type="number"
            min={0}
            className="input"
            value={values.minWeekday}
            onChange={(event) => setValues((current) => ({ ...current, minWeekday: event.target.value }))}
            placeholder="e.g. 8"
          />
        </FormField>
        <FormField label="Minimum Weekend Quantity" htmlFor="min-weekend">
          <input
            id="min-weekend"
            type="number"
            min={0}
            className="input"
            value={values.minWeekend}
            onChange={(event) => setValues((current) => ({ ...current, minWeekend: event.target.value }))}
            placeholder="Leave blank to use weekday value"
          />
        </FormField>
        <FormField label="Preferred Supplier" htmlFor="preferred-supplier">
          <Select
            id="preferred-supplier"
            options={supplierOptions}
            value={values.preferredSupplierId != null ? String(values.preferredSupplierId) : ''}
            onChange={(value) =>
              setValues((current) => ({ ...current, preferredSupplierId: value === '' ? null : Number(value) }))
            }
            ariaLabel="Preferred supplier"
          />
        </FormField>
        {validationError && <p className="form-field__error">{validationError}</p>}
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default StoreInventoryItemConfigModal;
