import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SearchableSelect from './SearchableSelect';

const OPTIONS = [
  { id: 1, label: 'Downtown' },
  { id: 2, label: 'Uptown' },
];

function openTrigger(user: ReturnType<typeof userEvent.setup>, id: string) {
  return user.click(document.getElementById(id)!);
}

function panel() {
  return screen.getByRole('listbox');
}

// RTS-374: a single-select store/owner filter needs an "All" row that can
// actually be clicked back to, and picking a specific store afterwards must
// still work -- previously the "applies to all" mutual-exclusion guard
// (built for multi-select forms like CategoryFormModal) leaked into
// single-select mode and blocked picking any option at all once "All" was
// the active selection (which it is by default).
describe('SearchableSelect', () => {
  it('single-select: a specific option can be picked while "All" is the active selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        id="store-filter"
        options={OPTIONS}
        selectedIds={[]}
        onChange={onChange}
        placeholder="All Stores"
        allOption={{ label: 'All Stores', selected: true, onToggle: vi.fn() }}
      />,
    );

    await openTrigger(user, 'store-filter');
    await user.click(within(panel()).getByText('Downtown'));
    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it('single-select: a specific option can still be picked once another option is already selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        id="store-filter"
        options={OPTIONS}
        selectedIds={[1]}
        onChange={onChange}
        placeholder="All Stores"
        allOption={{ label: 'All Stores', selected: false, onToggle: vi.fn() }}
      />,
    );

    await openTrigger(user, 'store-filter');
    await user.click(within(panel()).getByText('Uptown'));
    expect(onChange).toHaveBeenCalledWith([2]);
  });

  it('single-select: clicking "All" deselects back to it', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <SearchableSelect
        id="store-filter"
        options={OPTIONS}
        selectedIds={[1]}
        onChange={vi.fn()}
        placeholder="All Stores"
        allOption={{ label: 'All Stores', selected: false, onToggle }}
      />,
    );

    await openTrigger(user, 'store-filter');
    await user.click(within(panel()).getByText('All Stores'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('ticking "All" closes the panel', async () => {
    const user = userEvent.setup();

    render(
      <SearchableSelect
        id="category-stores"
        multiple
        options={OPTIONS}
        selectedIds={[]}
        onChange={vi.fn()}
        placeholder="Select store(s)"
        allOption={{ label: 'All Stores', selected: false, onToggle: vi.fn() }}
      />,
    );

    await openTrigger(user, 'category-stores');
    await user.click(within(panel()).getByText('All Stores'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('unticking "All" keeps the panel open so stores can be picked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <SearchableSelect
        id="category-stores"
        multiple
        options={OPTIONS}
        selectedIds={[]}
        onChange={vi.fn()}
        placeholder="Select store(s)"
        allOption={{ label: 'All Stores', selected: true, onToggle }}
      />,
    );

    await openTrigger(user, 'category-stores');
    await user.click(within(panel()).getByText('All Stores'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  // Existing multi-select "applies to all" behavior (CategoryFormModal and
  // friends) must be unchanged: once "All" is active, individual options
  // stay disabled until "All" is toggled off.
  it('multi-select: individual options stay blocked while "All" is active', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        id="category-stores"
        multiple
        options={OPTIONS}
        selectedIds={[]}
        onChange={onChange}
        placeholder="Select store(s)"
        allOption={{ label: 'All Stores', selected: true, onToggle: vi.fn() }}
      />,
    );

    await openTrigger(user, 'category-stores');
    const downtownOption = within(panel()).getByText('Downtown').closest('button')!;
    expect(downtownOption).toBeDisabled();
    await user.click(downtownOption);
    expect(onChange).not.toHaveBeenCalled();
  });
});
