import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as authApi from './api/auth'
import * as storesApi from './api/stores'
import * as meApi from './api/me'
import * as tasksApi from './api/tasks'
import type { StoreSummary } from './types/store'

const TOKEN_KEY = 'nforce-retailops-auth-token'
const ACTIVE_STORE_KEY = 'nforce-retailops-active-store'

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  getSessionConfig: vi.fn(),
}))

vi.mock('./api/stores', () => ({
  getAuthorizedStores: vi.fn(),
}))

vi.mock('./api/me', () => ({
  getMe: vi.fn(),
}))

vi.mock('./api/tasks', () => ({
  getDailyChecklist: vi.fn(),
  raiseIssue: vi.fn(),
  submitTaskResponse: vi.fn(),
  undoTaskResponse: vi.fn(),
}))

const mockLogin = vi.mocked(authApi.login)
const mockLogout = vi.mocked(authApi.logout)
const mockGetSessionConfig = vi.mocked(authApi.getSessionConfig)
const mockGetAuthorizedStores = vi.mocked(storesApi.getAuthorizedStores)
const mockGetMe = vi.mocked(meApi.getMe)
const mockGetDailyChecklist = vi.mocked(tasksApi.getDailyChecklist)

const STORE_1: StoreSummary = { id: 1, name: 'Store 1', location: 'Main St', status: 'Open' }
const STORE_2: StoreSummary = { id: 2, name: 'Store 2', location: 'Oak Ave', status: 'Open' }

async function loginAsEmployee(user: ReturnType<typeof userEvent.setup>) {
  mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe', mustResetPassword: false })
  await user.type(screen.getByLabelText(/email/i), 'jane@nforceone.com')
  await user.type(screen.getByLabelText(/^password$/i), 'password123')
  // "Remember me" defaults to unchecked, which stores the token in
  // sessionStorage instead of localStorage - check it so these tests keep
  // exercising (and asserting against) the persistent-session path.
  await user.click(screen.getByLabelText(/remember me/i))
  await user.click(screen.getByRole('button', { name: /sign in/i }))
  await screen.findByText(/select your store/i)
}

async function selectFirstOpenStore(user: ReturnType<typeof userEvent.setup>) {
  const storeCard = await screen.findByRole('button', { name: /store 1/i })
  await user.click(storeCard)
  await screen.findByRole('heading', { name: /today's tasks/i })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockLogout.mockResolvedValue(undefined)
  mockGetSessionConfig.mockReset()
  mockGetSessionConfig.mockResolvedValue({ inactivityTimeoutMinutes: 10 })
  mockGetAuthorizedStores.mockReset()
  // Two stores by default, so the picker is shown and has something to choose.
  mockGetAuthorizedStores.mockResolvedValue([STORE_1, STORE_2])
  mockGetMe.mockReset()
  // EmployeeDashboard also resolves the current employee via getMe() (for Undo
  // eligibility) independently of App's own session-restore call -- these tests
  // exercise auth/navigation, not that, so give it a harmless default.
  mockGetMe.mockResolvedValue({
    id: 1,
    fullName: 'Jane Doe',
    email: 'jane@nforceone.com',
    role: 'EMPLOYEE',
    storeNames: [],
    mustResetPassword: false,
  })
  mockGetDailyChecklist.mockReset()
  // These tests exercise auth/navigation, not checklist content.
  mockGetDailyChecklist.mockResolvedValue([])
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

  it('clears a stale token and returns to login when the stored session is rejected', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token-from-before-logout')
    mockGetMe.mockRejectedValue(new Error('Unauthorized'))

    render(<App />)

    await screen.findByText(/welcome back/i)
    expect(screen.queryByLabelText(/signed in as/i)).not.toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('session restore', () => {
  it('restores an employee session from a stored token on refresh', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token')
    localStorage.setItem(ACTIVE_STORE_KEY, String(STORE_2.id))
    mockGetMe.mockResolvedValue({
      id: 7,
      fullName: 'Jane Doe',
      email: 'jane@nforceone.com',
      role: 'EMPLOYEE',
      storeNames: ['Store 1', 'Store 2'],
      mustResetPassword: false,
    })

    render(<App />)

    // Straight back into the remembered store, no picker.
    await screen.findByRole('heading', { name: /today's tasks/i })
    expect(screen.queryByText(/select your store/i)).not.toBeInTheDocument()
  })

  it('falls back to the picker when the remembered store is no longer assigned', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token')
    localStorage.setItem(ACTIVE_STORE_KEY, '999')
    mockGetMe.mockResolvedValue({
      id: 7,
      fullName: 'Jane Doe',
      email: 'jane@nforceone.com',
      role: 'EMPLOYEE',
      storeNames: ['Store 1', 'Store 2'],
      mustResetPassword: false,
    })

    render(<App />)

    await screen.findByText(/select your store/i)
  })
})

describe('store selection', () => {
  it('auto-selects the only assigned store and hides the switch-store control', async () => {
    const user = userEvent.setup()
    mockGetAuthorizedStores.mockResolvedValue([STORE_1])
    mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe', mustResetPassword: false })

    render(<App />)
    await user.type(screen.getByLabelText(/email/i), 'jane@nforceone.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByRole('heading', { name: /today's tasks/i })
    expect(screen.queryByText(/select your store/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /switch store/i })).not.toBeInTheDocument()
  })

  it('shows an empty state when the employee has no assigned store', async () => {
    const user = userEvent.setup()
    mockGetAuthorizedStores.mockResolvedValue([])
    mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe', mustResetPassword: false })

    render(<App />)
    await user.type(screen.getByLabelText(/email/i), 'jane@nforceone.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByText(/no store assigned yet/i)
  })

  it('remembers the picked store so a multi-store employee is not asked again', async () => {
    const user = userEvent.setup()
    render(<App />)
    await loginAsEmployee(user)
    await selectFirstOpenStore(user)

    expect(localStorage.getItem(ACTIVE_STORE_KEY)).toBe(String(STORE_1.id))
  })
})
