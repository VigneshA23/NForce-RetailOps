import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Notifications from './Notifications';
import * as notificationsApi from '../api/notifications';
import * as receiptApi from '../api/stockReceiptRequests';
import type { Notification, StockReceiptRequest } from '../types/notification';

vi.mock('../api/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllRead: vi.fn(),
  markNotificationRead: vi.fn(),
  deleteNotification: vi.fn(),
}));
vi.mock('../api/stockReceiptRequests', () => ({
  approveStockReceiptRequest: vi.fn(),
  rejectStockReceiptRequest: vi.fn(),
}));

const request: StockReceiptRequest = {
  id: 9,
  kind: 'NEW_STOCK',
  status: 'PENDING',
  itemName: 'Milk',
  unit: 'L',
  quantity: 15,
  checkDate: '2026-10-13',
  requestedByName: 'Sarah',
  storeName: 'Main St',
  orderId: null,
  orderedQuantity: null,
  orderSupplierName: null,
  orderedAt: null,
  decidedByName: null,
  decidedAt: null,
};

function notification(receiptRequest: StockReceiptRequest): Notification {
  return {
    id: 1,
    title: 'Sarah reported received stock at Main St',
    message: 'Sarah reported receiving 15 L of Milk.',
    category: 'STOCK_RECEIPT_REQUEST',
    priority: 'HIGH',
    read: true,
    linkPath: '/notifications',
    relatedIssueId: null,
    relatedIssueNote: null,
    relatedStoreName: null,
    relatedIssueStatus: null,
    storeId: null,
    createdAt: new Date().toISOString(),
    receiptRequest,
  };
}

async function openNotification(receiptRequest: StockReceiptRequest) {
  vi.mocked(notificationsApi.getNotifications).mockResolvedValue([notification(receiptRequest)]);
  vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(0);
  render(<Notifications onUnreadChange={vi.fn()} />);
  await userEvent.click(await screen.findByText('Sarah reported received stock at Main St'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Notifications — received stock requests', () => {
  it('shows newly reported stock as a request for the received quantity, with Approve and Reject', async () => {
    await openNotification(request);

    expect(screen.getByText('Received stock, not on an existing order')).toBeInTheDocument();
    expect(screen.getByText(/requesting approval for the received quantity/)).toBeInTheDocument();
    expect(screen.getByText('15 L')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/ })).toBeInTheDocument();
    // A pending request has to be decided, not dismissed.
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('identifies the specific order when the employee confirms an existing Ordered order', async () => {
    await openNotification({
      ...request,
      kind: 'EXISTING_ORDER',
      orderId: 77,
      orderedQuantity: 12,
      orderSupplierName: 'Dairy Co',
    });

    expect(screen.getByText('Confirm existing order as received')).toBeInTheDocument();
    expect(screen.getByText(/confirm Order #77 as received/)).toBeInTheDocument();
    expect(screen.getByText('Order #77')).toBeInTheDocument();
    expect(screen.getByText('12 L')).toBeInTheDocument();
    expect(screen.getByText('Dairy Co')).toBeInTheDocument();
  });

  it('approving calls the API and then shows the decision instead of the buttons', async () => {
    vi.mocked(receiptApi.approveStockReceiptRequest).mockResolvedValue({
      ...request,
      status: 'APPROVED',
      decidedByName: 'Olivia',
      decidedAt: new Date().toISOString(),
    });
    await openNotification(request);

    await userEvent.click(screen.getByRole('button', { name: /Approve/ }));

    await waitFor(() => expect(receiptApi.approveStockReceiptRequest).toHaveBeenCalledWith(9));
    expect(await screen.findByText(/Approved by Olivia/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
  });

  it('rejecting calls the reject endpoint', async () => {
    vi.mocked(receiptApi.rejectStockReceiptRequest).mockResolvedValue({ ...request, status: 'REJECTED' });
    await openNotification(request);

    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));

    await waitFor(() => expect(receiptApi.rejectStockReceiptRequest).toHaveBeenCalledWith(9));
    expect(await screen.findByText(/Rejected/)).toBeInTheDocument();
  });

  it('keeps the buttons and shows the reason when the decision fails', async () => {
    vi.mocked(receiptApi.approveStockReceiptRequest).mockRejectedValue(new Error('This order is no longer Ordered.'));
    await openNotification(request);

    await userEvent.click(screen.getByRole('button', { name: /Approve/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This order is no longer Ordered.');
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
  });
});
