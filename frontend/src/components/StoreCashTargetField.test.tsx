import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AddStoreModal from './AddStoreModal';
import EditStoreModal from './EditStoreModal';
import SuperAdminStoreTable from './SuperAdminStoreTable';
import type { SuperAdminStore } from '../types/superAdminStore';

vi.mock('../api/owners', () => ({
  getNextStoreCode: vi.fn().mockResolvedValue(1001),
}));

async function fillAddForm(user: ReturnType<typeof userEvent.setup>, cashTarget: string) {
  await user.type(screen.getByLabelText(/store name/i), 'Uptown');
  await user.type(screen.getByLabelText(/store location/i), 'Main St');
  if (cashTarget) await user.type(screen.getByRole('textbox', { name: /^cash target/i }), cashTarget);
  await user.click(screen.getByRole('button', { name: 'Add Store' }));
}

describe('Add Store cash target', () => {
  it.each([
    ['', 'Cash target is required'],
    ['-5', 'Cash target cannot be negative'],
    ['abc', 'Cash target must be a number, e.g. 125.50'],
  ])('blocks save for %j', async (value, message) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddStoreModal isOpen onClose={() => {}} onSubmit={onSubmit} />);

    await fillAddForm(user, value);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not accept a third decimal place', async () => {
    const user = userEvent.setup();
    render(<AddStoreModal isOpen onClose={() => {}} onSubmit={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: /^cash target/i }), '10.555');

    expect(screen.getByRole('textbox', { name: /^cash target/i })).toHaveValue('10.55');
  });

  it('submits the target with the store, accepting 0', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddStoreModal isOpen onClose={() => {}} onSubmit={onSubmit} />);

    await fillAddForm(user, '0');

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Uptown', location: 'Main St', cashTarget: 0 });
  });
});

describe('Edit Store cash target', () => {
  it('shows the saved target and lets it be changed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <EditStoreModal
        isOpen
        initialValues={{ name: 'Uptown', location: 'Main St', cashTarget: 1250.5 }}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    const field = screen.getByRole('textbox', { name: /^cash target/i });
    expect(field).toHaveValue('1,250.50');

    await user.clear(field);
    await user.type(field, '300.25');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Uptown', location: 'Main St', cashTarget: 300.25 });
  });

  it('refuses a negative target on edit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <EditStoreModal
        isOpen
        initialValues={{ name: 'Uptown', location: 'Main St', cashTarget: 100 }}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );

    const field = screen.getByRole('textbox', { name: /^cash target/i });
    await user.clear(field);
    await user.type(field, '-1');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Cash target cannot be negative')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Store list cash target', () => {
  it('shows each store’s cash target', () => {
    const store: SuperAdminStore = {
      storeId: 1,
      storeCode: 101,
      storeName: 'Uptown',
      storeLocation: 'Main St',
      storeActive: true,
      ownerId: null,
      ownerName: null,
      ownerActive: null,
      ownerAccessActive: false,
      employeeCount: 0,
      taskCount: 0,
      cashTarget: 275.4,
    };
    render(
      <SuperAdminStoreTable
        stores={[store]}
        onViewDetails={() => {}}
        onToggleStatus={() => {}}
        onEdit={() => {}}
        onAssignOwner={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Cash Target' })).toBeInTheDocument();
    expect(screen.getAllByText('$275.40').length).toBeGreaterThan(0);
  });
});
