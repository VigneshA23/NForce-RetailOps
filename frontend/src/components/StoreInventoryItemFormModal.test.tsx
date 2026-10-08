import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// Mirrors the pages: the parent owns the supplier list and merges in
// anything the form creates inline.
function Harness({
  onSubmit,
  onCreate,
  initialValues,
}: {
  onSubmit: (values: StoreInventoryItemFormValues) => void;
  onCreate?: (name: string) => Promise<Supplier>;
  initialValues?: StoreInventoryItemFormValues;
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  async function handleCreate(name: string) {
    const created = onCreate ? await onCreate(name) : { id: 99, name, active: true };
    setSuppliers((current) => [...current, created]);
    return created;
  }
  return (
    <>
      <StoreInventoryItemFormModal
        isOpen
        mode={initialValues ? 'edit' : 'create'}
        suppliers={suppliers}
        onCreateSupplier={handleCreate}
        initialValues={initialValues}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
      <ul aria-label="directory">
        {suppliers.map((s) => (
          <li key={s.id}>{s.name}</li>
        ))}
      </ul>
    </>
  );
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
    render(<Harness onSubmit={vi.fn()} />);

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
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add to Catalog' }));

    expect(screen.getByText('Unit is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a legacy free-text unit selectable when editing an older item', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Harness
        onSubmit={onSubmit}
        initialValues={{
          storeId: null,
          name: 'Cups',
          category: 'SUPPLIES',
          unitOfMeasurement: 'box',
          minWeekday: '2',
          minWeekend: '',
          preferredSupplierId: 1,
          note: '',
          autoPoEnabled: true,
          imageId: null,
          imagePhotoId: null,
          imagePreviewUrl: null,
          removeImage: false,
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Unit' })).toHaveTextContent('box');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ unitOfMeasurement: 'box' }));
  });

  it('requires a preferred supplier', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: 'ml — Milliliters' }));
    await user.click(screen.getByRole('button', { name: 'Add to Catalog' }));

    expect(screen.getByText('Preferred supplier is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('filters active suppliers as the user types and selects a match', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.type(supplierInput, 'metro');

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Metro Wholesale' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Fresh Farms' })).not.toBeInTheDocument();
    // An exact match exists, so no "Add New Supplier" offer.
    await user.clear(supplierInput);
    await user.type(supplierInput, 'metro wholesale');
    expect(within(screen.getByRole('listbox')).queryByText(/Add New Supplier/)).not.toBeInTheDocument();

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
    render(<Harness onSubmit={vi.fn()} />);

    await user.type(screen.getByRole('combobox', { name: 'Preferred supplier' }), 'old');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: 'Old Supplier' })).not.toBeInTheDocument();
  });

  it('adds a new supplier from the typed name and selects it for the item', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCreate = vi.fn(async (name: string) => ({ id: 42, name, active: true }));
    render(<Harness onSubmit={onSubmit} onCreate={onCreate} />);

    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.type(supplierInput, 'Green Valley');
    await user.click(screen.getByRole('option', { name: /Add New Supplier "Green Valley"/ }));

    expect(onCreate).toHaveBeenCalledWith('Green Valley');
    await waitFor(() => expect(supplierInput).toHaveValue('Green Valley'));
    // Now part of the shared directory, so it's there for the next item too.
    expect(within(screen.getByRole('list', { name: 'directory' })).getByText('Green Valley')).toBeInTheDocument();

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: 'Nos. — Number of items' }));
    await user.click(screen.getByRole('button', { name: 'Add to Catalog' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ preferredSupplierId: 42 }));
  });

  it('keeps the form open and shows the error when adding a supplier fails', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => {
      throw new Error('Name is required');
    });
    render(<Harness onSubmit={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByRole('combobox', { name: 'Preferred supplier' }), 'Broken');
    await user.click(screen.getByRole('option', { name: /Add New Supplier/ }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
  });

  it('does not submit the item form when Enter is pressed in the supplier field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await fillRequired(user);
    const supplierInput = screen.getByRole('combobox', { name: 'Preferred supplier' });
    await user.type(supplierInput, 'fresh{Enter}');

    expect(supplierInput).toHaveValue('Fresh Farms');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('loads categories for the selected stores and offers only those', async () => {
    const user = userEvent.setup();
    const loadCategories = vi.fn().mockResolvedValue(['Dairy', 'Cleaning']);
    render(
      <StoreInventoryItemFormModal
        isOpen
        mode="create"
        suppliers={initialSuppliers}
        onCreateSupplier={vi.fn()}
        stores={[{ id: 1, name: 'Downtown' }, { id: 2, name: 'Uptown' }]}
        showStoreField
        loadCategories={loadCategories}
        initialValues={{ ...EMPTY, storeId: 1, storeIds: [1] }}
        onClose={() => {}}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() => expect(loadCategories).toHaveBeenCalledWith([1]));

    await user.click(screen.getByRole('button', { name: 'Select all stores' }));
    await waitFor(() => expect(loadCategories).toHaveBeenLastCalledWith([1, 2]));

    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    expect(await screen.findByText('Dairy')).toBeInTheDocument();
    expect(screen.queryByText('Packaging')).not.toBeInTheDocument();
  });
});

const EMPTY: StoreInventoryItemFormValues = {
  storeId: null,
  name: '',
  category: '',
  unitOfMeasurement: '',
  minWeekday: '',
  minWeekend: '',
  preferredSupplierId: null,
  note: '',
  autoPoEnabled: true,
  imageId: null,
  imagePhotoId: null,
  imagePreviewUrl: null,
  removeImage: false,
};
