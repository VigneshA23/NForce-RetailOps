import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Header from './Header'

function renderHeader(onLogout: () => void, loggingOut = false) {
  return render(
    <Header
      title="Employees"
      searchValue=""
      onSearchChange={() => {}}
      isDarkTheme={false}
      onToggleTheme={() => {}}
      userName="Alex Owner"
      onProfileClick={() => {}}
      onHelpClick={() => {}}
      onLogout={onLogout}
      loggingOut={loggingOut}
    />,
  )
}

describe('Header sign-out', () => {
  it('shows a log out option for the signed-in admin and calls onLogout after confirming', async () => {
    const onLogout = vi.fn()
    const user = userEvent.setup()
    renderHeader(onLogout)

    await user.click(screen.getByLabelText(/signed in as alex owner/i))
    await user.click(screen.getByRole('menuitem', { name: /log out/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^log out$/i }))

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('does not call onLogout when the confirmation is cancelled', async () => {
    const onLogout = vi.fn()
    const user = userEvent.setup()
    renderHeader(onLogout)

    await user.click(screen.getByLabelText(/signed in as alex owner/i))
    await user.click(screen.getByRole('menuitem', { name: /log out/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(onLogout).not.toHaveBeenCalled()
  })

  it('disables the menu item while a logout is already in progress', async () => {
    const onLogout = vi.fn()
    const user = userEvent.setup()
    renderHeader(onLogout, true)

    await user.click(screen.getByLabelText(/signed in as alex owner/i))
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeDisabled()
  })
})
