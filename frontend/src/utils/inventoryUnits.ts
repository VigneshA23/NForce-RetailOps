import { useSyncExternalStore } from 'react';
import type { SelectOption } from '../components/Select';
import { getInventoryUnits, type InventoryUnit } from '../api/inventoryUnits';
import { registerWholeNumberUnits } from './quantity';

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

// Value of the Super Admin-only dropdown entry that opens the "new unit" popup.
export const ADD_NEW_UNIT_VALUE = '__add_new_unit__';

// Units Super Admin added, shared by every picker and by the quantity helpers.
let customUnits: InventoryUnit[] = [];
const listeners = new Set<() => void>();

function setCustomUnits(units: InventoryUnit[]) {
  customUnits = units;
  registerWholeNumberUnits(units.filter((u) => u.wholeNumber).map((u) => u.name));
  listeners.forEach((listener) => listener());
}

export async function loadCustomUnits(): Promise<void> {
  try {
    setCustomUnits(await getInventoryUnits());
  } catch {
    // Non-fatal: built-in units still work; the list is retried on next load.
  }
}

export function addCustomUnit(unit: InventoryUnit) {
  setCustomUnits([...customUnits.filter((u) => u.id !== unit.id), unit]);
}

export function useCustomUnits(): InventoryUnit[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => customUnits,
  );
}

function unitLabel(unit: InventoryUnit): string {
  return `${unit.name} — ${unit.wholeNumber ? 'whole numbers' : 'decimals'}`;
}

// Items created before the unit list was fixed may hold a free-text unit
// (e.g. "box"). Keep that value selectable while editing such an item so
// opening and saving the form doesn't silently blank it. `custom` appends the
// Super Admin-added units; `canAddUnit` adds the leading "Add new unit" entry.
export function inventoryUnitOptionsFor(
  currentUnit: string,
  custom: InventoryUnit[] = [],
  canAddUnit = false,
): SelectOption[] {
  const options: SelectOption[] = [
    ...(canAddUnit ? [{ value: ADD_NEW_UNIT_VALUE, label: 'Add new unit', isAction: true }] : []),
    ...INVENTORY_UNIT_OPTIONS,
    ...custom.map((u) => ({ value: u.name, label: unitLabel(u) })),
  ];
  const unit = currentUnit.trim();
  if (unit && !options.some((option) => option.value === unit)) {
    options.push({ value: unit, label: unit });
  }
  return options;
}
