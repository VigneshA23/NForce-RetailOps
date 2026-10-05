import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockLevelComparison from './StockLevelComparison';
import * as stockLevelComparisonApi from '../api/stockLevelComparison';
import type { StockLevelComparisonRow } from '../types/stockLevelComparison';
import type { StoreInventoryItem } from '../types/storeInventory';

vi.mock('../api/stockLevelComparison', () => ({
  compareStockLevels: vi.fn(),
}));

// SearchableSelect is a portal-based combobox that measures real layout via
// getBoundingClientRect, which jsdom doesn't support meaningfully -- stub it
// with a plain <select> so this test can focus on StockLevelComparison's own
// dedup/fetch/render logic rather than fighting portal positioning.
vi.mock('./SearchableSelect', () => ({
  default: ({ options, onChange, placeholder }: {
    options: { id: number; label: string }[];
    onChange: (ids: number[]) => void;
    placeholder: string;
  }) => (
    <select
      aria-label={placeholder}
      onChange={(event) => onChange(event.target.value === '' ? [] : [Number(event.target.value)])}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  ),
}));

const mockCompareStockLevels = vi.mocked(stockLevelComparisonApi.compareStockLevels);

function item(overrides: Partial<StoreInventoryItem>): StoreInventoryItem {
  return {
    id: 1,
    storeId: 1,
    storeName: 'Store A',
    name: 'Napkins',
    category: null,
    unitOfMeasurement: 'ct',
    minWeekday: 10,
    minWeekend: null,
    preferredSupplierId: null,
    preferredSupplierName: null,
    note: null,
    active: true,
    autoPoEnabled: true,
    requiredToday: 10,
    currentAvailable: null,
    imageId: null,
    ...overrides,
  };
}

function row(overrides: Partial<StockLevelComparisonRow>): StockLevelComparisonRow {
  return {
    storeId: 1,
    storeName: 'Store A',
    assigned: true,
    requiredToday: 10,
    currentAvailable: 5,
    asOfDate: '2026-10-05',
    status: 'LOW',
    ...overrides,
  };
}

beforeEach(() => {
  mockCompareStockLevels.mockReset();
});

describe('StockLevelComparison', () => {
  it('dedupes item names across stores for the picker, case-insensitively', () => {
    const items = [
      item({ id: 1, storeId: 1, storeName: 'Store A', name: 'Napkins' }),
      item({ id: 2, storeId: 2, storeName: 'Store B', name: 'napkins' }),
      item({ id: 3, storeId: 1, storeName: 'Store A', name: 'Bread' }),
    ];
    render(<StockLevelComparison items={items} />);

    const select = screen.getByLabelText('Select an item to compare…');
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual(['Select an item to compare…', 'Bread', 'Napkins']);
  });

  it('fetches and renders the comparison once an item is selected', async () => {
    mockCompareStockLevels.mockResolvedValue([
      row({ storeId: 1, storeName: 'Store A', assigned: true, status: 'LOW' }),
      row({ storeId: 2, storeName: 'Store B', assigned: false, requiredToday: null, currentAvailable: null, asOfDate: null, status: null }),
    ]);
    const items = [item({ id: 1, storeId: 1, storeName: 'Store A', name: 'Napkins' })];
    render(<StockLevelComparison items={items} />);

    await userEvent.selectOptions(screen.getByLabelText('Select an item to compare…'), 'Napkins');

    await waitFor(() => expect(mockCompareStockLevels).toHaveBeenCalledWith('Napkins'));
    expect(await screen.findByText('Store A')).toBeInTheDocument();
    expect(screen.getByText('Below Minimum')).toBeInTheDocument();
    expect(screen.getByText('Store B')).toBeInTheDocument();
    expect(screen.getByText('Not Assigned')).toBeInTheDocument();
  });

  it('renders dashes rather than zeros for a not-assigned store', async () => {
    mockCompareStockLevels.mockResolvedValue([
      row({ storeId: 2, storeName: 'Store B', assigned: false, requiredToday: null, currentAvailable: null, asOfDate: null, status: null }),
    ]);
    const items = [item({ id: 1, storeId: 1, storeName: 'Store A', name: 'Napkins' })];
    render(<StockLevelComparison items={items} />);

    await userEvent.selectOptions(screen.getByLabelText('Select an item to compare…'), 'Napkins');

    const storeBCell = await screen.findByText('Store B');
    const cells = storeBCell.closest('tr')!.querySelectorAll('td');
    expect(cells[1].textContent).toBe('—');
    expect(cells[2].textContent).toBe('—');
    expect(cells[3].textContent).toBe('—');
  });
});
