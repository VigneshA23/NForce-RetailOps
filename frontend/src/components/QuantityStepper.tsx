import { Minus, Plus } from 'lucide-react';
import './QuantityStepper.css';

interface QuantityStepperProps {
  id?: string;
  value: number;
  unit?: string;
  min?: number;
  ariaLabel?: string;
  onChange: (value: number) => void;
}

// A +/- stepper around a directly-editable number field -- used wherever a
// count needs both quick nudging and exact entry (Add to order's quantity,
// Edit count's new count).
function QuantityStepper({ id, value, unit, min = 0, ariaLabel = 'Quantity', onChange }: QuantityStepperProps) {
  function commit(next: number) {
    onChange(Math.max(min, Number.isFinite(next) ? next : min));
  }

  return (
    <div className="quantity-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="quantity-stepper__btn"
        aria-label="Decrease"
        onClick={() => commit(value - 1)}
        disabled={value <= min}
      >
        <Minus size={18} />
      </button>
      <div className="quantity-stepper__field">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          className="quantity-stepper__input"
          value={value}
          onChange={(event) => commit(Number(event.target.value))}
        />
        {unit && <span className="quantity-stepper__unit">{unit}</span>}
      </div>
      <button type="button" className="quantity-stepper__btn" aria-label="Increase" onClick={() => commit(value + 1)}>
        <Plus size={18} />
      </button>
    </div>
  );
}

export default QuantityStepper;
