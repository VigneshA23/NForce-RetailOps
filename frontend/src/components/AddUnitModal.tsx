import { useEffect, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import { createInventoryUnit, type InventoryUnit } from '../api/inventoryUnits';
import './AddUnitModal.css';

interface AddUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (unit: InventoryUnit) => void;
}

// Super Admin only: names a new unit and says whether its quantities are whole
// numbers (e.g. box) or may have decimals (e.g. lb).
function AddUnitModal({ isOpen, onClose, onCreated }: AddUnitModalProps) {
  const [name, setName] = useState('');
  const [wholeNumber, setWholeNumber] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<{ name?: string; wholeNumber?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setWholeNumber(null);
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Unit name is required';
    if (wholeNumber === null) nextErrors.wholeNumber = 'Choose whole number or decimal';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || wholeNumber === null) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      onCreated(await createInventoryUnit(name.trim(), wholeNumber));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not add the unit');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Unit"
      subtitle="Available for every store's inventory items."
      centered
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-unit-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Add Unit'}
          </button>
        </>
      }
    >
      <form id="add-unit-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Unit Name *" htmlFor="new-unit-name" error={errors.name}>
          <input
            id="new-unit-name"
            className="input"
            value={name}
            maxLength={30}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. lb, box, dozen"
          />
        </FormField>
        <FormField label="Quantity Type *" htmlFor="new-unit-whole" error={errors.wholeNumber}>
          <div className="add-unit-modal__options" role="radiogroup" aria-label="Quantity type">
            <label className="add-unit-modal__option">
              <input id="new-unit-whole" type="radio" name="new-unit-type" checked={wholeNumber === true} onChange={() => setWholeNumber(true)} />
              Whole number
            </label>
            <label className="add-unit-modal__option">
              <input type="radio" name="new-unit-type" checked={wholeNumber === false} onChange={() => setWholeNumber(false)} />
              Decimal
            </label>
          </div>
        </FormField>
        {submitError && <p className="form-field__error">{submitError}</p>}
      </form>
    </Modal>
  );
}

export default AddUnitModal;
