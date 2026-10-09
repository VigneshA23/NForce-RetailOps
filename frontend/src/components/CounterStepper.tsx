import { Minus, Plus } from 'lucide-react';
import { isQtyInputAllowed, isWholeNumberUnit, roundQty } from '../utils/quantity';
import './CounterStepper.css';

interface CounterStepperProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  disabled?: boolean;
  // Countable units (Nos., box, bottle...) accept whole numbers only.
  unit?: string;
}

function CounterStepper({ id, value, onChange, min = 0, disabled = false, unit }: CounterStepperProps) {
  const numeric = Number(value);
  const canDecrement = !disabled && (!Number.isFinite(numeric) || numeric > min);

  function step(delta: number) {
    const current = Number.isFinite(numeric) ? numeric : min;
    const next = Math.max(min, current + delta);
    const stepped = isWholeNumberUnit(unit) ? Math.round(next) : roundQty(next);
    const text = String(stepped);
    if (isQtyInputAllowed(text, unit)) onChange(text);
  }

  return (
    <div className="counter-stepper">
      <button
        type="button"
        className="counter-stepper__btn"
        aria-label="Decrease"
        disabled={!canDecrement}
        onClick={() => step(-1)}
      >
        <Minus size={14} />
      </button>
      <input
        id={id}
        type="text"
        inputMode={isWholeNumberUnit(unit) ? 'numeric' : 'decimal'}
        className="counter-stepper__field"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          if (isQtyInputAllowed(event.target.value, unit)) onChange(event.target.value);
        }}
      />
      <button
        type="button"
        className="counter-stepper__btn"
        aria-label="Increase"
        disabled={disabled}
        onClick={() => step(1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export default CounterStepper;
