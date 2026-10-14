import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrderHistoryTable from './OrderHistoryTable';
import type { OrderHistoryEntry } from '../types/orderList';
import * as mediaQuery from '../hooks/useMediaQuery';

vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(() => false),
}));

const mockUseIsMobile = vi.mocked(mediaQuery.useIsMobile);

function historyEntry(overrides: Partial<OrderHistoryEntry>): OrderHistoryEntry {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Napkins',
    category: 'SUPPLIES',
    unitOfMeasurement: 'pack',
    imageId: null,
    supplierId: 1,
    supplierName: 'Acme Supplies',
    quantityOrdered: 10,
    quantityReceived: 10,
    status: 'RECEIVED',
    orderedAt: '2026-01-05T10:00:00+00:00',
    orderedByName: 'Jane Owner',
    receivedAt: '2026-01-06T09:30:00+00:00',
    receivedByName: 'Jane Owner',
    storeId: 1,
    storeName: 'Store A',
    ...overrides,
  };
}

describe('OrderHistoryTable', () => {
  it('renders an explicit empty state, not a blank table', () => {
    render(<OrderHistoryTable rows={[]} isLoading={false} />);

    expect(screen.getByText('No ordered or received records found for the selected filters.')).toBeInTheDocument();
  });

  it('shows a loading state instead of the empty state while fetching', () => {
    render(<OrderHistoryTable rows={[]} isLoading />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('No ordered or received records found for the selected filters.')).not.toBeInTheDocument();
  });

  it('renders item, supplier, quantities, attribution and status for a Received row', () => {
    render(<OrderHistoryTable rows={[historyEntry({})]} isLoading={false} />);

    const row = screen.getByText('Napkins').closest('tr')!;
    expect(row.querySelector('[data-label="Supplier"]')).toHaveTextContent('Acme Supplies');
    expect(row.querySelector('[data-label="Ordered Qty"]')).toHaveTextContent('10 pack');
    expect(row.querySelector('[data-label="Received Qty"]')).toHaveTextContent('10 pack');
    expect(row.querySelector('[data-label="Ordered"]')).toHaveTextContent('Jane Owner');
    expect(row.querySelector('[data-label="Received"]')).toHaveTextContent('Jane Owner');
    expect(row.querySelector('[data-label="Status"]')).toHaveTextContent('Received');
  });

  it('shows a dash for Received Qty and Received attribution on a row still awaiting receipt', () => {
    render(<OrderHistoryTable
      rows={[historyEntry({ status: 'ORDERED', quantityReceived: null, receivedAt: null, receivedByName: null })]}
      isLoading={false}
    />);

    const row = screen.getByText('Napkins').closest('tr')!;
    expect(row.querySelector('[data-label="Received Qty"]')).toHaveTextContent('—');
    expect(row.querySelector('[data-label="Received"]')).toHaveTextContent('—');
    expect(row.querySelector('[data-label="Status"]')).toHaveTextContent('Ordered');
  });

  describe('below --mobile', () => {
    beforeEach(() => mockUseIsMobile.mockReturnValue(true));
    afterEach(() => mockUseIsMobile.mockReturnValue(false));

    it('renders stacked cards instead of a table', () => {
      render(<OrderHistoryTable rows={[historyEntry({})]} isLoading={false} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      const card = screen.getByText('Napkins').closest('.order-history-table__card') as HTMLElement;
      expect(within(card).getByText('Acme Supplies')).toBeInTheDocument();
      expect(within(card).getByText('Received', { selector: '.order-history-table__status-pill' })).toBeInTheDocument();
      // Jane Owner ordered it and also received it -- appears in both timeline rows.
      expect(within(card).getAllByText('Jane Owner')).toHaveLength(2);
    });

    it('still shows the empty state without a table', () => {
      render(<OrderHistoryTable rows={[]} isLoading={false} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByText('No ordered or received records found for the selected filters.')).toBeInTheDocument();
    });
  });
});
