import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExpectedCashStat from './ExpectedCashStat';
import * as storeCashApi from '../api/storeCash';
import type { ExpectedCash } from '../types/storeCash';

vi.mock('../api/storeCash', () => ({
  getExpectedCash: vi.fn(),
  getSuperAdminExpectedCash: vi.fn(),
}));

// Fixed local "today" so the as-of and staleness wording is deterministic.
const TODAY = new Date(2026, 10, 10, 12, 0, 0); // 10 Nov 2026, local noon

function expected(overrides: Partial<ExpectedCash> = {}): ExpectedCash {
  return {
    storeId: 7,
    available: true,
    message: null,
    asOfDate: '2026-11-10',
    lastUpdatedAt: '2026-11-10T09:15:00Z',
    expectedCashOnHand: 1234.5,
    cashRemaining: 1234.5,
    variance: 0,
    openingDrawerCash: 200,
    totalCashSales: 1034.5,
    cashRemoved: 0,
    bankDeposits: 0,
    cashExpenses: 0,
    otherAdjustments: 0,
    ...overrides,
  };
}

const NO_DATA = expected({
  available: false,
  message: 'No cash entries have been recorded for this store yet',
  asOfDate: null,
  lastUpdatedAt: null,
  expectedCashOnHand: null,
  cashRemaining: null,
  variance: null,
  openingDrawerCash: null,
  totalCashSales: null,
  cashRemoved: null,
  bankDeposits: null,
  cashExpenses: null,
  otherAdjustments: null,
});

function card(): HTMLElement {
  return screen.getByText('Expected Cash on Hand').closest('.stat-card') as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  vi.mocked(storeCashApi.getExpectedCash).mockReset().mockResolvedValue(expected());
  vi.mocked(storeCashApi.getSuperAdminExpectedCash).mockReset().mockResolvedValue(expected());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExpectedCashStat', () => {
  it('shows a loading state before the figure arrives', async () => {
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
  });

  it('formats the figure in USD and says which day it is from', async () => {
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
    const asOf = new Date(2026, 10, 10).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    expect(screen.getByText(`As of ${asOf}`)).toBeInTheDocument();
    expect(card()).toHaveClass('stat-card--success', 'expected-cash-stat__card--green');
  });

  it('renders a negative figure with a minus sign and a warning tone', async () => {
    vi.mocked(storeCashApi.getExpectedCash).mockResolvedValue(expected({ expectedCashOnHand: -12.5 }));
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('-$12.50')).toBeInTheDocument();
    expect(card()).toHaveClass('stat-card--warning');
  });

  it('does not flag an entry from yesterday', async () => {
    vi.mocked(storeCashApi.getExpectedCash).mockResolvedValue(expected({ asOfDate: '2026-11-09' }));
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
    expect(screen.queryByText(/days ago/)).not.toBeInTheDocument();
    expect(card()).toHaveClass('stat-card--success');
  });

  it('still shows an older entry, but flags how old it is', async () => {
    vi.mocked(storeCashApi.getExpectedCash).mockResolvedValue(expected({ asOfDate: '2026-11-04' }));
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
    expect(screen.getByText(/last entry 6 days ago$/)).toBeInTheDocument();
    expect(card()).toHaveClass('stat-card--warning');
  });

  it('shows "No data yet" instead of an amount when the store has no entries', async () => {
    vi.mocked(storeCashApi.getExpectedCash).mockResolvedValue(NO_DATA);
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Save a daily cash entry to see this figure')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Last updated/)).not.toBeInTheDocument();
  });

  it('says when the latest entry was last saved', async () => {
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
    const savedAt = new Date('2026-11-10T09:15:00Z').toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    expect(screen.getByText(`Last updated ${savedAt}`)).toBeInTheDocument();
  });

  it('keeps showing an old entry as the live figure, with its own last-updated time', async () => {
    vi.mocked(storeCashApi.getExpectedCash).mockResolvedValue(
      expected({ asOfDate: '2026-11-01', lastUpdatedAt: '2026-11-01T20:00:00Z', expectedCashOnHand: 300 }),
    );
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('$300.00')).toBeInTheDocument();
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
    expect(screen.getByText(/^Last updated /)).toBeInTheDocument();
  });

  it('offers a retry when the figure cannot be loaded', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getExpectedCash)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(NO_DATA);
    render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Expected Cash on Hand/ }));

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(storeCashApi.getExpectedCash).toHaveBeenCalledTimes(2);
  });

  it('uses the Super Admin endpoint for the given store', async () => {
    render(<ExpectedCashStat scope="super-admin" storeId={42} refreshKey={0} />);

    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
    expect(storeCashApi.getSuperAdminExpectedCash).toHaveBeenCalledWith(42, expect.any(AbortSignal));
    expect(storeCashApi.getExpectedCash).not.toHaveBeenCalled();
  });

  it('refetches when refreshKey changes and keeps the old figure until the new one arrives', async () => {
    let resolveSecond: (value: ExpectedCash) => void = () => {};
    vi.mocked(storeCashApi.getExpectedCash)
      .mockResolvedValueOnce(expected({ expectedCashOnHand: 100 }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));
    const { rerender } = render(<ExpectedCashStat scope="owner" storeId={7} refreshKey={0} />);
    expect(await screen.findByText('$100.00')).toBeInTheDocument();

    rerender(<ExpectedCashStat scope="owner" storeId={7} refreshKey={1} />);
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    resolveSecond(expected({ expectedCashOnHand: 540 }));
    expect(await screen.findByText('$540.00')).toBeInTheDocument();
    expect(storeCashApi.getExpectedCash).toHaveBeenCalledTimes(2);
  });
});
