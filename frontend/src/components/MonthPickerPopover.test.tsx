import { fireEvent, render, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import MonthPickerPopover from './MonthPickerPopover';

function Harness({ value, max, onSelect = vi.fn(), onClose = vi.fn() }: {
  value: string;
  max?: string;
  onSelect?: (month: string) => void;
  onClose?: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef}>anchor</button>
      <MonthPickerPopover value={value} max={max} isOpen onClose={onClose} onSelect={onSelect} anchorRef={anchorRef} />
    </>
  );
}

function monthName(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

describe('MonthPickerPopover', () => {
  it('shows the value year with twelve months and marks the selected one', () => {
    render(<Harness value="2026-03" />);
    const dialog = screen.getByRole('dialog', { name: 'Choose a month' });

    expect(within(dialog).getByText('2026')).toBeInTheDocument();
    const selected = within(dialog).getByRole('button', { name: monthName(2026, 2) });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveClass('calendar-popover__cell--selected');
    expect(within(dialog).getAllByRole('button', { name: /2026$/ })).toHaveLength(12);
  });

  it('disables months after max and the next-year button at the max year', () => {
    render(<Harness value="2026-06" max="2026-08" />);
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('button', { name: monthName(2026, 7) })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: monthName(2026, 8) })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Next year' })).toBeDisabled();
  });

  it('opens a year grid from the year label and returns to that year’s months', () => {
    const onSelect = vi.fn();
    render(<Harness value="2026-06" max="2026-08" onSelect={onSelect} />);
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: '2026, choose a year' }));
    expect(within(dialog).getByText('2016 – 2027')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '2027' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'Next years' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Previous years' }));
    expect(within(dialog).getByText('2004 – 2015')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '2012' }));

    expect(within(dialog).getByRole('button', { name: '2012, choose a year' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: monthName(2012, 1) }));
    expect(onSelect).toHaveBeenCalledWith('2012-02');
  });

  it('steps back a year and selects a month from it', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<Harness value="2026-06" max="2026-08" onSelect={onSelect} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Previous year' }));
    expect(within(dialog).getByText('2025')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: monthName(2025, 10) }));

    expect(onSelect).toHaveBeenCalledWith('2025-11');
    expect(onClose).toHaveBeenCalled();
  });
});
