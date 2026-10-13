import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmployeeStockCheck from './EmployeeStockCheck';
import * as meApi from '../api/me';
import * as stockCheckApi from '../api/stockChecks';
import type { DailyStockCheckItem } from '../types/stockCheck';
import type { StoreSummary } from '../types/store';

vi.mock('../api/me', () => ({ getMe: vi.fn() }));
vi.mock('../api/stockChecks', () => ({
  getTodayStockCheck: vi.fn(),
  reportAdHocShortage: vi.fn(),
  submitStockCheck: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetMe = vi.mocked(meApi.getMe);
const mockGetTodayStockCheck = vi.mocked(stockCheckApi.getTodayStockCheck);

const store: StoreSummary = { id: 1, name: 'Keds Ice Cream - Plano', location: null, status: 'Open' };

const item: DailyStockCheckItem = {
  storeInventoryItemId: 1,
  itemName: 'Milk',
  unitOfMeasurement: 'Nos.',
  minTarget: 8,
  requiredTomorrow: null,
  startOfDay: null,
  endOfDay: null,
  currentStock: null,
  stockUsed: null,
  quantityToOrder: null,
  imageId: null,
};

describe('EmployeeStockCheck item card expand/collapse', () => {
  it('expands and collapses when the header row itself is clicked, not just the chevron', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([item]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('Milk');

    // Pending status (no counts yet) starts collapsed.
    expect(screen.queryByText('Shift Stock Reconciliations')).not.toBeInTheDocument();

    // Click the item name -- not the chevron -- and it should still expand.
    await user.click(screen.getByText('Milk'));
    await waitFor(() => expect(screen.getByText('Shift Stock Reconciliations')).toBeInTheDocument());

    // Click empty space on the header (the target text) to collapse again.
    await user.click(screen.getByText(/Today's target/));
    await waitFor(() => expect(screen.queryByText('Shift Stock Reconciliations')).not.toBeInTheDocument());
  });
});
