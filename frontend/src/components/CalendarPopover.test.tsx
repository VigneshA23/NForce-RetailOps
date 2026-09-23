import { render, screen, within } from '@testing-library/react'
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
