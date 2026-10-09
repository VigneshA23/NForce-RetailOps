import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatQty, parseQty, roundQty } from '../utils/quantity';
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
// Edit count's new count). Accepts up to two decimals (1.25 kg). The field
// keeps its own text so a half-typed "1." isn't snapped back mid-keystroke.
function QuantityStepper({ id, value, unit, min = 0, ariaLabel = 'Quantity', onChange }: QuantityStepperProps) {
  const [text, setText] = useState(() => formatQty(value));

  // Follow the value when it changes from outside (reset, +/- buttons), but
  // not while the typed text already parses to it.
  useEffect(() => {
    setText((current) => (parseQty(current) === value ? current : formatQty(value)));
  }, [value]);

  function commit(next: number) {
    const clamped = roundQty(Math.max(min, Number.isFinite(next) ? next : min));
    setText(formatQty(clamped));
    onChange(clamped);
  }

  function handleType(raw: string) {
    setText(raw);
    const parsed = parseQty(raw);
    if (parsed !== null) onChange(Math.max(min, parsed));
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
          step="any"
          inputMode="decimal"
          min={min}
          className="quantity-stepper__input"
          value={text}
          onChange={(event) => handleType(event.target.value)}
          onBlur={() => setText(formatQty(value))}
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
