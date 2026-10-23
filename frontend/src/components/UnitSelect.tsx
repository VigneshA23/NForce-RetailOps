import { useState } from 'react';
import Select from './Select';
import AddUnitModal from './AddUnitModal';
import { ADD_NEW_UNIT_VALUE, addCustomUnit, inventoryUnitOptionsFor, useCustomUnits } from '../utils/inventoryUnits';

interface UnitSelectProps {
  id: string;
  value: string;
  // The item's saved unit, kept selectable if it's an old free-text value.
  savedUnit: string;
  onChange: (unit: string) => void;
  // Super Admin only: adds the "Add new unit" entry and its popup.
  canAddUnit?: boolean;
}

function UnitSelect({ id, value, savedUnit, onChange, canAddUnit = false }: UnitSelectProps) {
  const customUnits = useCustomUnits();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const options = inventoryUnitOptionsFor(savedUnit, customUnits, canAddUnit);

  return (
    <>
      <Select
        id={id}
        options={options}
        value={value}
        onChange={(next) => (next === ADD_NEW_UNIT_VALUE ? setIsAddOpen(true) : onChange(next))}
        ariaLabel="Unit"
        placeholder="Select unit..."
      />
      {canAddUnit && (
        <AddUnitModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onCreated={(unit) => {
            addCustomUnit(unit);
            onChange(unit.name);
            setIsAddOpen(false);
          }}
        />
      )}
    </>
  );
}

export default UnitSelect;
