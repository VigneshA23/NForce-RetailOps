import type { CategoryStoreOption } from '../types/category';
import './CategoryStorePicker.css';

interface CategoryStorePickerValue {
  appliesToAllStores: boolean;
  storeIds: number[];
}

interface CategoryStorePickerProps {
  stores: CategoryStoreOption[];
  value: CategoryStorePickerValue;
  onChange: (next: CategoryStorePickerValue) => void;
}

function CategoryStorePicker({ stores, value, onChange }: CategoryStorePickerProps) {
  function handleAllStoresToggle(checked: boolean) {
    onChange({ appliesToAllStores: checked, storeIds: checked ? [] : value.storeIds });
  }

  function handleStoreToggle(storeId: number, checked: boolean) {
    const next = checked
      ? [...value.storeIds, storeId]
      : value.storeIds.filter((id) => id !== storeId);
    onChange({ appliesToAllStores: false, storeIds: next });
  }

  return (
    <div className="category-store-picker">
      <label className="category-store-picker__option category-store-picker__option--all">
        <input
          type="checkbox"
          checked={value.appliesToAllStores}
          onChange={(event) => handleAllStoresToggle(event.target.checked)}
        />
        All Stores
      </label>
      {!value.appliesToAllStores && (
        <div className="category-store-picker__list">
          {stores.map((store) => (
            <label key={store.id} className="category-store-picker__option">
              <input
                type="checkbox"
                checked={value.storeIds.includes(store.id)}
                onChange={(event) => handleStoreToggle(store.id, event.target.checked)}
              />
              {store.name}
            </label>
          ))}
          {stores.length === 0 && (
            <p className="category-store-picker__empty">No stores available to select.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoryStorePicker;
