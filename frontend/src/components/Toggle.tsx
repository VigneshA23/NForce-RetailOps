import { Switch as SwitchPrimitive } from 'radix-ui';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

// Built on Radix's Switch primitive instead of a plain button -- same
// role="switch"/aria-checked contract as before (Radix sets these itself),
// but gains keyboard Space/Enter toggling and the focus-visible ring for
// free. Colors are pinned to this app's own on/off tokens (green on, red
// off) rather than shadcn's default primary/input scheme, and track/thumb
// sizing (44x24, 20px thumb) matches the original exactly so no layout
// shifts at any of this component's call sites.
function Toggle({ checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={`toggle${checked ? ' toggle--on' : ''} relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-[var(--color-toggle-off-bg)] bg-[var(--color-toggle-off-bg)] outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--color-badge-icon-success-fg)] data-[state=checked]:bg-[var(--color-badge-icon-success-fg)]`}
    >
      <SwitchPrimitive.Thumb className="toggle__thumb block size-5 translate-x-px rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-150 data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

export default Toggle;
