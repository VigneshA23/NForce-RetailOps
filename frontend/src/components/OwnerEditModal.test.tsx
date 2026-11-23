import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerEditModal from './OwnerEditModal';
import * as ownersApi from '../api/owners';

vi.mock('../api/owners', () => ({
  getReassignableStores: vi.fn(),
}));

const mockGetReassignable = vi.mocked(ownersApi.getReassignableStores);

const CURRENT = [{ id: 11, label: 'North', sublabel: '#501' }];

beforeEach(() => {
  mockGetReassignable.mockReset();
  mockGetReassignable.mockResolvedValue([
    { storeId: 13, storeCode: 503, storeName: 'East', storeLocation: 'Elm St', currentOwnerName: null },
  ]);
});

function renderModal(onSubmit = vi.fn(), errorMessage: string | null = null) {
  render(
    <OwnerEditModal
      isOpen
      initialValues={{ ownerName: 'Priya Admin', ownerEmail: 'priya@nforce.test' }}
      currentStores={CURRENT}
      errorMessage={errorMessage}
      onClose={() => {}}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe('OwnerEditModal stores', () => {
  it('pre-selects the admin’s current stores and submits them unchanged', async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledWith({ ownerName: 'Priya Admin', ownerEmail: 'priya@nforce.test' }, [11]);
  });

  it('lets a vacant store be added and a current one removed', async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();
    await vi.waitFor(() => expect(mockGetReassignable).toHaveBeenCalled());

    await user.click(document.getElementById('edit-owner-stores')!);
    const panel = screen.getByRole('listbox');
    await user.click(await within(panel).findByText('East'));
    await user.click(within(panel).getByText('North'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), [13]);
  });

  it('shows a rejected store assignment inline', () => {
    renderModal(vi.fn(), 'An admin is already assigned to this store');
    expect(screen.getByText('An admin is already assigned to this store')).toBeInTheDocument();
  });
});

// RTS-582: same email rule and message as the Login page.
describe('OwnerEditModal email', () => {
  it('blocks saving a malformed email', async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    const email = screen.getByLabelText(/owner email/i);
    await user.clear(email);
    await user.type(email, 'priya@nforce');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
