import { fireEvent, render, screen, within } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import CalendarPopover from './CalendarPopover'

function Harness({ value, min, max }: { value: string; min?: string; max?: string }) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={anchorRef}>anchor</button>
      <CalendarPopover value={value} min={min} max={max} isOpen onClose={vi.fn()} onSelect={vi.fn()} anchorRef={anchorRef} />
    </>
  )
}

describe('CalendarPopover', () => {
  it('disables cells before min', () => {
    render(<Harness value="2026-06-15" min="2026-06-10" />)
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByRole('button', { name: '5' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '10' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: '15' })).toBeEnabled()
  })

  it('disables cells after max', () => {
    render(<Harness value="2026-06-15" max="2026-06-20" />)
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByRole('button', { name: '25' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '20' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: '15' })).toBeEnabled()
  })

  it('disables cells before min but keeps existing max behavior intact when both are set', () => {
    render(<Harness value="2026-06-15" min="2026-06-10" max="2026-06-20" />)
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByRole('button', { name: '5' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '25' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '15' })).toBeEnabled()
  })

  it('disables Previous-month navigation once the visible month is entirely before min', () => {
    render(<Harness value="2026-06-15" min="2026-06-15" />)

    expect(screen.getByRole('button', { name: /previous month/i })).toBeDisabled()
  })

  it('keeps Previous-month navigation enabled when the previous month still has dates on/after min', () => {
    render(<Harness value="2026-07-15" min="2026-06-15" />)

    expect(screen.getByRole('button', { name: /previous month/i })).toBeEnabled()
  })

  it('has no min-date restriction by default (existing max-only behavior unaffected)', () => {
    render(<Harness value="2026-06-15" max="2026-06-20" />)
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByRole('button', { name: '1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /previous month/i })).toBeEnabled()
  })
})

describe('CalendarPopover month and year views', () => {
  const monthName = (y: number, m: number) =>
    new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  it('opens the months from the header label and returns to the picked month days', () => {
    render(<Harness value="2026-06-15" max="2026-08-20" />)
    const dialog = screen.getByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: `${monthName(2026, 5)}, choose a month` }))
    expect(within(dialog).getByRole('button', { name: monthName(2026, 5) })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: monthName(2026, 7) })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: monthName(2026, 8) })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Next year' })).toBeDisabled()

    fireEvent.click(within(dialog).getByRole('button', { name: monthName(2026, 2) }))
    expect(within(dialog).getByRole('button', { name: `${monthName(2026, 2)}, choose a month` })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '31' })).toBeInTheDocument()
  })

  it('opens the years from the month view and respects min', () => {
    render(<Harness value="2026-06-15" min="2020-03-10" />)
    const dialog = screen.getByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: `${monthName(2026, 5)}, choose a month` }))
    fireEvent.click(within(dialog).getByRole('button', { name: '2026, choose a year' }))
    expect(within(dialog).getByText('2016 – 2027')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '2019' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '2020' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Previous years' })).toBeDisabled()

    fireEvent.click(within(dialog).getByRole('button', { name: '2020' }))
    expect(within(dialog).getByRole('button', { name: monthName(2020, 1) })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: monthName(2020, 2) })).toBeEnabled()
  })
})
