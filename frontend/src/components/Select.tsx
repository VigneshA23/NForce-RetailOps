import { Check, Plus } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { cn } from 'cn';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
  // Highlighted action entry (e.g. "Add new unit"): accent colour and a plus
  // icon instead of a selection indicator, like the category picker's.
  isAction?: boolean;
}

interface SelectProps {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  // 'left' (default): panel's left edge lines up with the trigger's left
  // edge, growing rightward -- fine when there's room to the right. 'right':
  // panel's right edge lines up with the trigger's right edge instead,
  // growing leftward -- for a trigger already sitting at the right edge of
  // its own container (e.g. a card header's period dropdown), where growing
  // rightward has nowhere to go and pushes the panel past the container.
  align?: 'left' | 'right';
  // 'check' (default): a checkmark beside the selected option. 'radio': a
  // radio-button circle beside every option, for single-choice pickers where
  // the one-of-many nature should be obvious (e.g. inventory units).
  indicator?: 'check' | 'radio';
}

// Built on shadcn/Radix's Select instead of a hand-rolled portal + manual
// viewport-clamping (createPortal/useDismissablePanel) -- Radix's Popper
// already solves collision detection (flipping/clamping near a screen edge,
// which matters most on mobile table cells) and focus/keyboard handling
// natively. Item content is composed directly from the raw Radix primitives
// (not the generated ui/select.tsx SelectItem) so the indicator can stay
// left-aligned before the label, matching this app's existing look, and so
// the 'radio' variant and the accent "action" row (e.g. "+ Add new unit")
// can render their own leading glyph instead of Radix's built-in trailing
// checkmark.
function CustomSelectItem({
  option,
  isSelected,
  indicator,
}: {
  option: SelectOption;
  isSelected: boolean;
  indicator: 'check' | 'radio';
}) {
  if (option.isAction) {
    return (
      <SelectPrimitive.Item
        value={option.value}
        className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold text-primary outline-hidden select-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      >
        <Plus size={14} className="shrink-0" />
        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }

  return (
    <SelectPrimitive.Item
      value={option.value}
      className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      {indicator === 'radio' ? (
        <span
          aria-hidden="true"
          className={cn(
            'relative size-4 shrink-0 rounded-full border border-border',
            isSelected && 'border-primary',
          )}
        >
          {isSelected && <span className="absolute inset-[3px] rounded-full bg-primary" />}
        </span>
      ) : (
        <span className="flex size-3.5 shrink-0 items-center justify-center text-primary">
          <SelectPrimitive.ItemIndicator>
            <Check size={14} />
          </SelectPrimitive.ItemIndicator>
        </span>
      )}
      <SelectPrimitive.ItemText className={cn(isSelected && 'font-semibold')}>{option.label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function CustomSelect({
  id,
  options,
  value,
  onChange,
  ariaLabel,
  className,
  placeholder,
  disabled,
  align = 'left',
  indicator = 'check',
}: SelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align={align === 'right' ? 'end' : 'start'} className="min-w-[8rem]">
        {options.map((option) => (
          <CustomSelectItem key={option.value} option={option} isSelected={option.value === value} indicator={indicator} />
        ))}
      </SelectContent>
    </Select>
  );
}

export default CustomSelect;
