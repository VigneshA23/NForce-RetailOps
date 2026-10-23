import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StoreInventoryItemFormModal from './StoreInventoryItemFormModal';
import type { Supplier } from '../types/supplier';
import type { StoreInventoryItemFormValues } from '../types/storeInventory';

const initialSuppliers: Supplier[] = [
  { id: 1, name: 'Fresh Farms', active: true },
  { id: 2, name: 'Metro Wholesale', active: true },
  { id: 3, name: 'Old Supplier', active: false },
];

const CATEGORIES = ['Dairy', 'Cleaning'];

const EMPTY: StoreInventoryItemFormValues = {
  storeId: null,
  name: '',
  category: '',
  unitOfMeasurement: '',
  minWeekday: '',
  minWeekend: '',
  preferredSupplierId: null,
  note: '',
  imageId: null,
  imagePhotoId: null,
  imagePreviewUrl: null,
  removeImage: false,
};

// Defaults mirror Super Admin's own usage (both "Add new..." options present);
// Owner/Admin's real usage omits onRequestCreateSupplier/onRequestCreateCategory
// entirely, covered by the dedicated tests below.
function renderModal(overrides: Partial<React.ComponentProps<typeof StoreInventoryItemFormModal>> = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn();
  render(
    <StoreInventoryItemFormModal
      isOpen
      mode={overrides.initialValues ? 'edit' : 'create'}
      suppliers={initialSuppliers}
      restrictedCategories={CATEGORIES}
      onRequestCreateSupplier={vi.fn()}
      onRequestCreateCategory={vi.fn()}
      onClose={() => {}}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit };
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Item Name'), 'Milk');
  await user.type(screen.getByLabelText('Min Par Level (Weekday)'), '5');
  await user.click(screen.getByRole('combobox', { name: 'Category' }));
  await user.click(screen.getByRole('option', { name: 'Dairy' }));
}

describe('StoreInventoryItemFormModal', () => {
  it('offers exactly the five fixed units as a single-choice list', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Unit' }));
    const listbox = screen.getByRole('listbox');
    const labels = within(listbox).getAllByRole('option').map((option) => option.textContent);
    expect(labels).toEqual([
      'g — Grams',
      'kg — Kilograms',
      'ml — Milliliters',
      'L — Liters',
      'Nos. — Number of items',
    ]);

    await user.click(screen.getByRole('option', { name: 'kg — Kilograms' }));
    expect(screen.getByRole('button', { name: 'Unit' })).toHaveTextContent('kg — Kilograms');

    // Picking another replaces the first -- only one unit at a time.
    await user.click(screen.getByRole('button', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: 'L — Liters' }));
    expect(screen.getByRole('button', { name: 'Unit' })).toHaveTextContent('L — Liters');
  });

  it('requires a unit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add to Catalog' }));

    expect(screen.getByText('Unit is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a legacy free-text unit selectable when editing an older item', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal({
      initialValues: {
        storeId: null,
        name: 'Cups',
        category: 'Cleaning',
        unitOfMeasurement: 'box',
        minWeekday: '2',
        minWeekend: '',
        preferredSupplierId: 1,
        note: '',
        imageId: null,
        imagePhotoId: null,
        imagePreviewUrl: null,
        removeImage: false,
      },
    });

    expect(screen.getByRole('button', { name: 'Unit' })).toHaveTextContent('box');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ unitOfMeasurement: 'box' }));
  });

  it('allows saving without a preferred supplier', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: 'ml — Milliliters' }));
    await user.click(screen.getByRole('button', { name: 'Add to Catalog' }));

    expect(screen.queryByText('Preferred supplier is required')).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ preferredSupplierId: null }));
  });

  it('filters active suppliers as the user types and selects a match', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.type(supplierInput, 'metro');

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Metro Wholesale' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Fresh Farms' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Metro Wholesale' }));
    expect(supplierInput).toHaveValue('Metro Wholesale');

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: 'ml — Milliliters' }));
    await user.click(screen.getByRole('button', { name: 'Add to Catalog' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ preferredSupplierId: 2, unitOfMeasurement: 'ml' }));
  });

  it('does not list inactive suppliers', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByRole('combobox', { name: 'Preferred supplier' }), 'old');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: 'Old Supplier' })).not.toBeInTheDocument();
  });

  it('offers no way to add a supplier when onRequestCreateSupplier is omitted', async () => {
    const user = userEvent.setup();
    renderModal({ onRequestCreateSupplier: undefined });

    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.click(supplierInput);
    expect(screen.queryByRole('option', { name: 'Add new supplier' })).not.toBeInTheDocument();
  });

  it('starts empty (not "No preferred supplier") until the field is actually touched', () => {
    renderModal();
    expect(screen.getByRole('combobox', { name: 'Preferred supplier' })).toHaveValue('');
  });

  it('shows "No preferred supplier" as the value once that option is explicitly chosen', async () => {
    const user = userEvent.setup();
    renderModal();

    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.click(supplierInput);
    await user.click(screen.getByRole('option', { name: 'No preferred supplier' }));

    expect(supplierInput).toHaveValue('No preferred supplier');
  });

  // Editing an existing item that already has no supplier is a different
  // case from a brand-new item's untouched field above: the item's current,
  // already-saved answer IS "no preferred supplier", so the field should
  // read as that answer immediately rather than the ambiguous blank/
  // placeholder state a never-touched field shows.
  it('shows "No preferred supplier" immediately when editing an existing item that already has none', () => {
    renderModal({
      initialValues: {
        storeId: null,
        name: 'Dev test EOD1',
        category: 'Dairy',
        unitOfMeasurement: 'Nos.',
        minWeekday: '5',
        minWeekend: '8',
        preferredSupplierId: null,
        note: '',
        imageId: null,
        imagePhotoId: null,
        imagePreviewUrl: null,
        removeImage: false,
      },
    });

    expect(screen.getByRole('combobox', { name: 'Preferred supplier' })).toHaveValue('No preferred supplier');
  });

  it('invites selecting only (no "add") when onRequestCreateSupplier is omitted, selecting otherwise', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <StoreInventoryItemFormModal
        isOpen
        mode="create"
        suppliers={initialSuppliers}
        restrictedCategories={CATEGORIES}
        onClose={() => {}}
        onSubmit={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Preferred supplier' }));
    expect(screen.getByRole('combobox', { name: 'Preferred supplier' })).toHaveAttribute('placeholder', 'Select supplier');
    unmount();

    renderModal();
    await user.click(screen.getByRole('combobox', { name: 'Preferred supplier' }));
    expect(screen.getByRole('combobox', { name: 'Preferred supplier' })).toHaveAttribute('placeholder', 'Select or add a supplier');
  });

  // "Add new supplier" leaves the item form for the Suppliers page instead of
  // creating one in place, since a supplier's store assignment belongs there.
  it('leaves the form for the Suppliers page when "Add new supplier" is chosen, without picking anything', async () => {
    const user = userEvent.setup();
    const onRequestCreateSupplier = vi.fn();
    renderModal({ onRequestCreateSupplier });

    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.click(supplierInput);
    await user.click(screen.getByRole('option', { name: 'Add new supplier' }));

    expect(onRequestCreateSupplier).toHaveBeenCalledTimes(1);
    expect(supplierInput).toHaveValue('');
  });

  it('does not submit the item form when Enter is pressed in the supplier field', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await fillRequired(user);
    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.type(supplierInput, 'fresh{Enter}');

    expect(supplierInput).toHaveValue('Fresh Farms');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('recomputes categories and suppliers for the selected stores as they change', async () => {
    const user = userEvent.setup();
    const getCategoriesForStores = vi.fn((storeIds: number[]) => (storeIds.includes(2) ? [] : ['Dairy']));
    const getSuppliersForStores = vi.fn((storeIds: number[]) => (storeIds.includes(2) ? [] : [initialSuppliers[0]]));
    renderModal({
      mode: 'create',
      stores: [{ id: 1, name: 'Downtown' }, { id: 2, name: 'Uptown' }],
      showStoreField: true,
      getCategoriesForStores,
      getSuppliersForStores,
      initialValues: { ...EMPTY, storeId: 1, storeIds: [1] },
    });

    expect(getCategoriesForStores).toHaveBeenCalledWith([1]);
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    expect(screen.getByRole('option', { name: 'Dairy' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Dairy' }));
    await user.click(screen.getByRole('combobox', { name: 'Preferred supplier' }));
    await user.click(screen.getByRole('option', { name: 'Fresh Farms' }));

    // Adding a second store the category/supplier aren't assigned to clears
    // the choices already made rather than silently keeping them.
    await user.click(screen.getByRole('button', { name: 'Select all stores' }));
    expect(getCategoriesForStores).toHaveBeenLastCalledWith([1, 2]);
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Preferred supplier' })).toHaveValue('');
  });

  // Owner/Admin: categories come entirely from Super Admin's assignment list
  // -- no "Add new category" option.
  it('restricts the category field to the given list with no way to add one', async () => {
    const user = userEvent.setup();
    renderModal({ restrictedCategories: ['Dairy', 'Packaging'], onRequestCreateCategory: undefined });

    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Dairy' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Packaging' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Ingredients' })).not.toBeInTheDocument();
    expect(within(listbox).queryByText(/Add new category/)).not.toBeInTheDocument();
  });

  // "Add new category" leaves the item form for the Categories page instead
  // of creating one in place, since a category's store assignment belongs there.
  it('leaves the form for the Categories page when "Add new category" is chosen, without picking anything', async () => {
    const user = userEvent.setup();
    const onRequestCreateCategory = vi.fn();
    renderModal({ onRequestCreateCategory });

    const categoryInput = screen.getByRole('combobox', { name: 'Category' });
    await user.click(categoryInput);
    await user.click(screen.getByRole('option', { name: 'Add new category' }));

    expect(onRequestCreateCategory).toHaveBeenCalledTimes(1);
    expect(categoryInput).toHaveValue('');
  });
});
