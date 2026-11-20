import { DollarSign } from 'lucide-react';
import FormField from './FormField';
import { formatAmount } from '../utils/currency';
import { limitDecimals, parseAmount, validateAmount } from '../utils/amountInput';

export const CASH_TARGET_LABEL = 'Cash target';

// The store create/edit forms' required cash-drawer target: a number of 0 or
// more with at most 2 decimals (the backend enforces the same).
export function validateCashTarget(raw: string): string | undefined {
  return validateAmount(CASH_TARGET_LABEL, raw);
}

interface StoreCashTargetFieldProps {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function StoreCashTargetField({ id, value, error, onChange }: StoreCashTargetFieldProps) {
  return (
    <FormField
      label={CASH_TARGET_LABEL}
      htmlFor={id}
      required
      error={error}
      description="How much cash the drawer should start each day with."
    >
      <div className="supplier-form__input-wrap">
        <DollarSign size={15} className="supplier-form__input-icon" aria-hidden="true" />
        <input
          id={id}
          className="input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(limitDecimals(event.target.value))}
          // Tidy a valid entry to two decimals, as the cash screens do.
          onBlur={() => {
            if (!validateCashTarget(value)) onChange(formatAmount(parseAmount(value)));
          }}
        />
      </div>
    </FormField>
  );
}

export default StoreCashTargetField;
