import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryStorePicker from './CategoryStorePicker';

const STORES = [
  { id: 1, name: 'Downtown' },
  { id: 2, name: 'Uptown' },
];

describe('CategoryStorePicker', () => {
  it('hides the store list and clears storeIds when All Stores is checked', () => {
    const onChange = vi.fn();
    render(
      <CategoryStorePicker
        stores={STORES}
        value={{ appliesToAllStores: false, storeIds: [1] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('All Stores'));

    expect(onChange).toHaveBeenCalledWith({ appliesToAllStores: true, storeIds: [] });
  });

  it('adds a store id when its checkbox is checked', () => {
    const onChange = vi.fn();
    render(
      <CategoryStorePicker
        stores={STORES}
        value={{ appliesToAllStores: false, storeIds: [1] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Uptown'));

    expect(onChange).toHaveBeenCalledWith({ appliesToAllStores: false, storeIds: [1, 2] });
  });
});
