import type { SelectOption } from '../components/Select';

// The fixed set of units an inventory item can be counted in. `value` is
// what's stored on the item (store_inventory_items.unit_of_measurement) and
// shown next to counts elsewhere, e.g. "Target: 8 kg".
export const INVENTORY_UNIT_OPTIONS: SelectOption[] = [
  { value: 'g', label: 'g — Grams' },
  { value: 'kg', label: 'kg — Kilograms' },
  { value: 'ml', label: 'ml — Milliliters' },
  { value: 'L', label: 'L — Liters' },
  { value: 'Nos.', label: 'Nos. — Number of items' },
];

// Items created before the unit list was fixed may hold a free-text unit
// (e.g. "box"). Keep that value selectable while editing such an item so
// opening and saving the form doesn't silently blank it.
export function inventoryUnitOptionsFor(currentUnit: string): SelectOption[] {
  const unit = currentUnit.trim();
  if (!unit || INVENTORY_UNIT_OPTIONS.some((option) => option.value === unit)) {
    return INVENTORY_UNIT_OPTIONS;
  }
  return [...INVENTORY_UNIT_OPTIONS, { value: unit, label: unit }];
}
