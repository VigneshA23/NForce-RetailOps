import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SupplierFormModal from './SupplierFormModal';
import type { SupplierFormValues } from '../types/supplier';

// The Super Admin page builds initialValues inline, so every re-render of the
// page (its 60-second polls) hands the open modal a new object.
function renderEdit(onSubmit: (values: SupplierFormValues) => void) {
  return (
    <SupplierFormModal
      isOpen
      mode="edit"
      extended
      availableStores={[{ id: 1, name: 'Plano' }] as never}
      initialValues={{ name: 'Walmart', contact: '', location: 'Old St', appliesToAllStores: true, storeIds: [] }}
      onClose={() => {}}
      onSubmit={onSubmit}
    />
  );
}

describe('Edit Supplier keeps unsaved edits', () => {
  it('does not reset typed changes when the page re-renders', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(renderEdit(onSubmit));

    const name = screen.getByLabelText('Supplier Name');
    await user.clear(name);
    await user.type(name, 'Walmart Supercenter');

    rerender(renderEdit(onSubmit)); // a background poll re-renders the page

    expect(screen.getByLabelText('Supplier Name')).toHaveValue('Walmart Supercenter');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Walmart Supercenter' }));
  });
});

describe('Edit Supplier loads the chosen supplier each time it opens', () => {
  it('shows the next supplier after closing and reopening', () => {
    const props = { mode: 'edit' as const, extended: true, onClose: () => {}, onSubmit: vi.fn() };
    const { rerender } = render(
      <SupplierFormModal {...props} isOpen initialValues={{ name: 'Walmart', appliesToAllStores: true }} />,
    );
    expect(screen.getByLabelText('Supplier Name')).toHaveValue('Walmart');

    rerender(<SupplierFormModal {...props} isOpen={false} initialValues={{ name: 'Walmart', appliesToAllStores: true }} />);
    rerender(<SupplierFormModal {...props} isOpen initialValues={{ name: 'Costco', appliesToAllStores: true }} />);

    expect(screen.getByLabelText('Supplier Name')).toHaveValue('Costco');
  });
});
