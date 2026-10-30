import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface StatusDotOption {
  value: string;
  label: string;
  dot: string;
}

interface StatusDotMenuProps {
  options: StatusDotOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  width?: number;
}

// A status picker styled after the Orders redesign: a colored dot in both the
// trigger and each option, instead of Select's plain text list. Built on
// shadcn/Radix's DropdownMenu instead of a hand-rolled portal, so viewport
// collision handling (flipping above the trigger, clamping to screen edges
// near table edges on mobile) comes from Radix's Popper rather than custom
// reposition math. Colors are pinned to this screen's own fixed `--ops-*`
// tokens (see tokens.css) rather than the general shadcn theme tokens, since
// Order List/End of Day Report were deliberately built with their own
// palette independent of the rest of the app's light/dark theming.
function StatusDotMenu({ options, value, onChange, ariaLabel, width = 172 }: StatusDotMenuProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          style={{ width }}
          className="flex h-9 items-center gap-2 rounded-md border border-[var(--ops-border)] bg-[var(--ops-surface)] py-0 pr-2.5 pl-3 text-[13px] font-semibold text-[var(--ops-text)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50"
        >
          <span className="size-2 shrink-0 rounded-full" style={{ background: selected?.dot }} />
          <span className="flex-1 truncate text-left">{selected?.label}</span>
          <ChevronDown size={14} className="shrink-0 text-[var(--ops-text-faint)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        collisionPadding={8}
        aria-label={ariaLabel}
        style={{ width }}
        className="border-[var(--ops-border)] bg-[var(--ops-surface)] p-[5px] text-[var(--ops-text)]"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className="gap-2.5 rounded-lg py-2 text-[var(--ops-text)] focus:bg-[var(--ops-surface-muted)]"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: option.dot }} />
            <span className="flex-1">{option.label}</span>
            {option.value === value && <Check size={16} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default StatusDotMenu;
