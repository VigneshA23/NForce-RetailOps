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
  it('groups the expand caret beside quantity needed and exposes shortage status separately', async () => {
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{ ...item, currentStock: 2 }]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('6 Nos. Needed');

    const itemCard = screen.getByText('Milk').closest('.employee-stock-check-page__item');
    const neededGroup = itemCard?.querySelector('.employee-stock-check-page__needed-group');
    expect(neededGroup?.querySelector('.employee-stock-check-page__needed-badge')).toBeInTheDocument();
    expect(neededGroup?.querySelector('.employee-stock-check-page__collapse-toggle')).toBeInTheDocument();
    expect(itemCard?.querySelector('.employee-stock-check-page__status-badge')).toHaveTextContent('Shortage');
  });

  it('marks Par Met as a status badge for the compact card layout', async () => {
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{ ...item, currentStock: 8 }]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('Par Met');

    const itemCard = screen.getByText('Milk').closest('.employee-stock-check-page__item');
    expect(itemCard?.querySelector('.employee-stock-check-page__status-badge')).toHaveTextContent('Par Met');
    expect(itemCard?.querySelector('.employee-stock-check-page__collapse-toggle')).toBeInTheDocument();
  });

  it('expands and collapses when the header row itself is clicked, not just the chevron', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([item]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('Milk');
    expect(screen.getByText('Qty Needed = Min Target − Available')).toBeInTheDocument();
    const itemCard = screen.getByText('Milk').closest('.employee-stock-check-page__item');
    const neededGroup = itemCard?.querySelector('.employee-stock-check-page__needed-group');
    expect(neededGroup?.contains(itemCard?.querySelector('.employee-stock-check-page__collapse-toggle') ?? null)).toBe(true);

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

describe('EmployeeStockCheck status filters', () => {
  it('matches Stock Check History status options and separates shortages from sufficient or uncounted items', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([
      { ...item, storeInventoryItemId: 1, itemName: 'Milk', currentStock: 2 },
      { ...item, storeInventoryItemId: 2, itemName: 'Sugar', currentStock: 8 },
      { ...item, storeInventoryItemId: 3, itemName: 'Flour', currentStock: null },
    ]);

    render(<EmployeeStockCheck store={store} />);

    await screen.findByText('Milk');
    expect(screen.getByRole('button', { name: 'All Records (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shortage (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sufficient (2)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Shortage (1)' }));
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Sugar')).not.toBeInTheDocument();
    expect(screen.queryByText('Flour')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sufficient (2)' }));
    expect(screen.getByText('Sugar')).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  });
});

describe('EmployeeStockCheck missing End of Day from yesterday', () => {
  const blocked: DailyStockCheckItem = { ...item, missedEndOfDay: { date: '2026-10-14' } };

  async function expandMilk(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText('Milk');
    await user.click(screen.getByText('Milk'));
    await waitFor(() => expect(screen.getByText('Shift Stock Reconciliations')).toBeInTheDocument());
  }

  it('flags the item on its card', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([blocked]);

    render(<EmployeeStockCheck store={store} />);
    await expandMilk(user);

    expect(screen.getByText(/Yesterday's End of Day is missing/)).toBeInTheDocument();
  });

  it('shows the popup instead of saving Start of Day, and its button opens the notifications', async () => {
    const user = userEvent.setup();
    const onOpenNotifications = vi.fn();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([blocked]);

    const { container } = render(<EmployeeStockCheck store={store} onOpenNotifications={onOpenNotifications} />);
    await expandMilk(user);

    await user.type(container.querySelector('#stock-1-sod-available') as HTMLInputElement, '5');
    await user.click(screen.getAllByRole('button', { name: 'Save Check' })[0]);

    expect(await screen.findByText("Yesterday's End of Day is missing")).toBeInTheDocument();
    expect(stockCheckApi.submitStockCheck).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Respond in notifications' }));
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('does not flag an item that has no missing End of Day', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([item]);

    render(<EmployeeStockCheck store={store} />);
    await expandMilk(user);

    expect(screen.queryByText(/Yesterday's End of Day is missing/)).not.toBeInTheDocument();
  });
});
