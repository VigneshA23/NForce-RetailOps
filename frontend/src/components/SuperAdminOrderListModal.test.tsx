import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SuperAdminOrderListModal from './SuperAdminOrderListModal';
import * as saOpsApi from '../api/superAdminOperations';
import type { OrderListEntry } from '../types/orderList';

vi.mock('../api/superAdminOperations', () => ({
  getOrderListForStore: vi.fn(),
  updateSuperAdminOrderStatus: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetOrderListForStore = vi.mocked(saOpsApi.getOrderListForStore);
const mockUpdateSuperAdminOrderStatus = vi.mocked(saOpsApi.updateSuperAdminOrderStatus);

function entry(overrides: Partial<OrderListEntry> = {}): OrderListEntry {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Milk',
    unitOfMeasurement: 'Gallons',
    quantityNeeded: 4,
    supplierId: null,
    supplierName: null,
    note: null,
    status: 'NEEDS_ORDERING',
    adHoc: false,
    raisedByName: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    imageId: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetOrderListForStore.mockReset();
  mockUpdateSuperAdminOrderStatus.mockReset();
});

describe('SuperAdminOrderListModal', () => {
  it('is closed and makes no request when store is null', () => {
    render(<SuperAdminOrderListModal store={null} onClose={vi.fn()} />);
    expect(mockGetOrderListForStore).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('loads and lists the given store\'s order-list entries', async () => {
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk' }), entry({ id: 2, itemName: 'Bread' })]);

    render(<SuperAdminOrderListModal store={{ storeId: 10, storeName: 'Downtown' }} onClose={vi.fn()} />);

    expect(mockGetOrderListForStore).toHaveBeenCalledWith(10);
    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
  });

  it('changes an entry\'s status and notifies the caller so counts can refresh', async () => {
    const user = userEvent.setup();
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk', status: 'NEEDS_ORDERING' })]);
    mockUpdateSuperAdminOrderStatus.mockResolvedValue(entry({ itemName: 'Milk', status: 'ORDERED' }));
    const onStatusChanged = vi.fn();

    render(
      <SuperAdminOrderListModal
        store={{ storeId: 10, storeName: 'Downtown' }}
        onClose={vi.fn()}
        onStatusChanged={onStatusChanged}
      />,
    );

    await screen.findByText('Milk');
    await user.click(screen.getByRole('button', { name: 'Change status for Milk' }));
    await user.click(screen.getByRole('option', { name: 'Ordered' }));

    await waitFor(() => expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalledWith(10, 1, 'ORDERED'));
    expect(onStatusChanged).toHaveBeenCalled();
  });

  it('shows an error toast and leaves the entry unchanged when the status update is rejected', async () => {
    const user = userEvent.setup();
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk', status: 'NEEDS_ORDERING' })]);
    mockUpdateSuperAdminOrderStatus.mockRejectedValue(new Error('Cannot move this order from NEEDS_ORDERING to RECEIVED'));
    const onStatusChanged = vi.fn();

    render(
      <SuperAdminOrderListModal
        store={{ storeId: 10, storeName: 'Downtown' }}
        onClose={vi.fn()}
        onStatusChanged={onStatusChanged}
      />,
    );

    await screen.findByText('Milk');
    await user.click(screen.getByRole('button', { name: 'Change status for Milk' }));
    await user.click(screen.getByRole('option', { name: 'Received' }));

    await waitFor(() => expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalled());
    expect(onStatusChanged).not.toHaveBeenCalled();
  });
});
