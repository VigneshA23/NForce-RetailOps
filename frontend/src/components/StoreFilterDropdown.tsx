import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import './StoreFilterDropdown.css';

export type StoreCompletionStatus = 'completed' | 'in-progress' | 'unscheduled';

export interface StoreFilterOption {
  id: number;
  name: string;
  status: StoreCompletionStatus;
}

interface StoreFilterDropdownProps {
  options: StoreFilterOption[];
  // Empty selection means "All Stores".
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

const STATUS_LABEL: Record<StoreCompletionStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  unscheduled: 'Unscheduled',
};

// A multi-select filter -- picking an option toggles it without closing the
// menu, same as a checkbox list. Built on shadcn DropdownMenu's
// CheckboxItem, which (like Radix's underlying primitive) already stays open
// on select, so no custom "keep open" handling is needed the way a plain
// DropdownMenuItem would.
function StoreFilterDropdown({ options, selectedIds, onChange }: StoreFilterDropdownProps) {
  function toggleOption(optionId: number) {
    if (selectedIds.includes(optionId)) {
      onChange(selectedIds.filter((id) => id !== optionId));
    } else {
      onChange([...selectedIds, optionId]);
    }
  }

  const isAllSelected = selectedIds.length === 0;
  const selectedNames = options.filter((option) => selectedIds.includes(option.id)).map((option) => option.name);
  const triggerLabel = isAllSelected
    ? 'All Stores'
    : selectedNames.length === 1
      ? selectedNames[0]
      : `${selectedNames.length} stores selected`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="store-filter__trigger" aria-label="Filter stores">
          <span className="store-filter__label">{triggerLabel}</span>
          <ChevronDown size={14} className="store-filter__chevron" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="store-filter__panel w-[220px] max-h-[280px] border-border bg-[var(--color-surface-card)] p-1"
      >
        <DropdownMenuCheckboxItem checked={isAllSelected} onCheckedChange={() => onChange([])}>
          All Stores
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="store-filter__divider" />
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          return (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={isSelected}
              onCheckedChange={() => toggleOption(option.id)}
              className="gap-2"
            >
              <span
                className={`store-filter__status-dot store-filter__status-dot--${option.status}`}
                aria-hidden="true"
              />
              <span className="store-filter__option-name">{option.name}</span>
              <span className="store-filter__option-status">{STATUS_LABEL[option.status]}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default StoreFilterDropdown;
