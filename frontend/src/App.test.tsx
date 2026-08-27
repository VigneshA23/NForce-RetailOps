import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as authApi from './api/auth'

const TOKEN_KEY = 'nforce-retailops-auth-token'

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

const mockLogin = vi.mocked(authApi.login)
const mockLogout = vi.mocked(authApi.logout)

async function loginAsEmployee(user: ReturnType<typeof userEvent.setup>) {
  mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe' })
  await user.type(screen.getByLabelText(/email/i), 'jane@nforceone.com')
  await user.type(screen.getByLabelText(/^password$/i), 'password123')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
  await screen.findByText(/select your store/i)
}

async function selectFirstOpenStore(user: ReturnType<typeof userEvent.setup>) {
  const storeCard = await screen.findByRole('button', { name: /store 1/i })
  await user.click(storeCard)
  await screen.findByRole('heading', { name: /welcome, jane doe/i })
}

beforeEach(() => {
  localStorage.clear()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockLogout.mockResolvedValue(undefined)
})

describe('sign-out', () => {
  it('does not expose a sign-out control on the login screen', () => {
    render(<App />)
    expect(screen.queryByLabelText(/signed in as/i)).not.toBeInTheDocument()
  })

  it('lets an authenticated employee sign out via the profile menu, clearing the token and returning to login', async () => {
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user)
    await selectFirstOpenStore(user)

    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token')

    const trigger = screen.getByLabelText(/signed in as jane doe/i)
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: /log out/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^log out$/i }))

    await screen.findByText(/welcome back/i)
    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('shows the confirmation popup on the Select Your Store page, and keeps the user signed in on Cancel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user)

    expect(screen.queryByText(/^log out$/i)).not.toBeInTheDocument()

    const trigger = screen.getByLabelText(/signed in as jane doe/i)
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: /log out/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/are you sure you want to log out\?/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockLogout).not.toHaveBeenCalled()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token')
    await screen.findByText(/select your store/i)
  })

  it('still logs out locally when the backend logout call fails', async () => {
    mockLogout.mockRejectedValueOnce(new Error('network error'))
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user)
    await selectFirstOpenStore(user)

    await user.click(screen.getByLabelText(/signed in as jane doe/i))
    await user.click(screen.getByRole('menuitem', { name: /log out/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^log out$/i }))

    await screen.findByText(/welcome back/i)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('does not issue duplicate logout requests while a logout is already in progress', async () => {
    let resolveLogout: () => void = () => {}
    mockLogout.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve
        }),
    )
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user)

    const trigger = screen.getByLabelText(/signed in as jane doe/i)
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: /log out/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^log out$/i }))

    await user.click(trigger)
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeDisabled()

    resolveLogout()
    await screen.findByText(/welcome back/i)
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('keeps the user logged out after a simulated refresh, even with a stale token in storage', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token-from-before-logout')

    const { unmount } = render(<App />)
    unmount()
    render(<App />)

    await screen.findByText(/welcome back/i)
    expect(screen.queryByLabelText(/signed in as/i)).not.toBeInTheDocument()
  })
})
