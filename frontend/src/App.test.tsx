import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as authApi from './api/auth'
import * as storesApi from './api/stores'
import * as meApi from './api/me'
import * as tasksApi from './api/tasks'
import * as missedTasksApi from './api/missedTasks'
import { ApiError } from './api/client'
import type { StoreSummary } from './types/store'

const TOKEN_KEY = 'nforce-retailops-auth-token'
const ACTIVE_STORE_KEY = 'nforce-retailops-active-store'

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  getSessionConfig: vi.fn(),
  getSessionStatus: vi.fn(),
}))

vi.mock('./api/stores', () => ({
  getAuthorizedStores: vi.fn(),
}))

vi.mock('./api/me', () => ({
  getMe: vi.fn(),
}))

vi.mock('./api/tasks', () => ({
  getDailyChecklist: vi.fn(),
  submitTaskResponse: vi.fn(),
  undoTaskResponse: vi.fn(),
}))

vi.mock('./api/missedTasks', () => ({
  getMissedTasks: vi.fn().mockResolvedValue({ groups: [], nextCursor: null, totalInstances: 0 }),
  moveMissedTask: vi.fn(),
}))

vi.mock('./api/issues', () => ({
  raiseIssue: vi.fn(),
  getMyIssues: vi.fn().mockResolvedValue([]),
}))

vi.mock('./api/notifications', () => ({
  getUnreadCount: vi.fn().mockResolvedValue(0),
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
  markAllRead: vi.fn(),
  deleteNotification: vi.fn(),
}))

const mockLogin = vi.mocked(authApi.login)
const mockLogout = vi.mocked(authApi.logout)
const mockGetSessionConfig = vi.mocked(authApi.getSessionConfig)
const mockGetSessionStatus = vi.mocked(authApi.getSessionStatus)
const mockGetAuthorizedStores = vi.mocked(storesApi.getAuthorizedStores)
const mockGetMe = vi.mocked(meApi.getMe)
const mockGetDailyChecklist = vi.mocked(tasksApi.getDailyChecklist)
const mockGetMissedTasks = vi.mocked(missedTasksApi.getMissedTasks)

const STORE_1: StoreSummary = { id: 1, name: 'Store 1', location: 'Main St', status: 'Open' }
const STORE_2: StoreSummary = { id: 2, name: 'Store 2', location: 'Oak Ave', status: 'Open' }

async function loginAsEmployee(user: ReturnType<typeof userEvent.setup>) {
  mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe', mustResetPassword: false, sessionTimeoutMinutes: 30 })
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
  mockGetSessionConfig.mockResolvedValue({ inactivityTimeoutMinutes: 10, rememberMeTimeoutMinutes: 240 })
  mockGetSessionStatus.mockReset()
  mockGetSessionStatus.mockResolvedValue({ remainingSeconds: 600 })
  mockGetAuthorizedStores.mockReset()
  // Two stores by default, so the picker is shown and has something to choose.
  mockGetAuthorizedStores.mockResolvedValue([STORE_1, STORE_2])
  mockGetMe.mockReset()
  // App's own useMe() call resolves this once per session and shares it down
  // into EmployeeDashboard (for Undo eligibility) and Profile -- these tests
  // exercise auth/navigation, not that, so give it a harmless default.
  mockGetMe.mockResolvedValue({
    id: 1,
    fullName: 'Jane Doe',
    email: 'jane@nforceone.com',
    role: 'EMPLOYEE',
    storeNames: [],
    mustResetPassword: false,
    employeeType: null,
    phone: null,
    avatarUrl: null,
  })
  mockGetDailyChecklist.mockReset()
  // These tests exercise auth/navigation, not checklist content.
  mockGetDailyChecklist.mockResolvedValue([])
  mockGetMissedTasks.mockReset()
  mockGetMissedTasks.mockResolvedValue({ groups: [], nextCursor: null, totalInstances: 0 })
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

  it('clears a stale token and returns to login when the stored session is rejected with a 401', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token-from-before-logout')
    mockGetMe.mockRejectedValue(new ApiError(401, 'Unauthorized'))

    render(<App />)

    await screen.findByText(/welcome back/i)
    expect(screen.queryByLabelText(/signed in as/i)).not.toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('Remember Me persistence', () => {
  it('stores the token in localStorage (survives browser close) when Remember Me is checked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user) // helper already checks Remember Me

    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token')
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('stores the token in sessionStorage only (does not survive browser close) when Remember Me is left unchecked', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe', mustResetPassword: false, sessionTimeoutMinutes: 30 })
    render(<App />)

    await user.type(screen.getByLabelText(/email/i), 'jane@nforceone.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    // Remember Me left unchecked this time.
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await screen.findByText(/select your store/i)

    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('test-token')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('cross-tab session sync', () => {
  it('ends this tab\'s session when another tab clears the shared auth token', async () => {
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user)
    await selectFirstOpenStore(user)

    // Simulate the effect of another tab logging out / expiring: the shared
    // localStorage key is cleared and a native `storage` event fires (jsdom,
    // like real browsers, does not dispatch this in the SAME tab that made
    // the change, so it must be dispatched explicitly here to simulate the
    // OTHER tab's write being observed by this one).
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new StorageEvent('storage', {
      key: TOKEN_KEY,
      newValue: null,
      storageArea: localStorage,
    }))

    await screen.findByText(/you have been logged out/i)
    expect(screen.queryByLabelText(/signed in as/i)).not.toBeInTheDocument()
  })
})

describe('session countdown accuracy after refresh', () => {
  it('seeds the UX countdown from the real remaining server-side time, not the full policy duration', async () => {
    // Simulates a page refresh mid-session: a token already sits in storage
    // (as if this were a remembered session restored, not a fresh login), and
    // the server reports only a sliver of time left on it -- proving the
    // countdown is seeded from that real remaining time (and ends the session
    // almost immediately) rather than restarting at the full default.
    localStorage.setItem(TOKEN_KEY, 'valid-token')
    localStorage.setItem(ACTIVE_STORE_KEY, String(STORE_1.id))
    mockGetMe.mockResolvedValue({
      id: 7,
      fullName: 'Jane Doe',
      email: 'jane@nforceone.com',
      role: 'EMPLOYEE',
      storeNames: ['Store 1'],
      mustResetPassword: false,
      employeeType: null,
      phone: null,
      avatarUrl: null,
    })
    mockGetSessionStatus.mockResolvedValue({ remainingSeconds: 0.05 })

    render(<App />)

    await screen.findByRole('heading', { name: /today's tasks/i })
    await screen.findByText(/welcome back/i, {}, { timeout: 2000 })
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('keeps the session alive when the real remaining time is still substantial', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token')
    localStorage.setItem(ACTIVE_STORE_KEY, String(STORE_1.id))
    mockGetMe.mockResolvedValue({
      id: 7,
      fullName: 'Jane Doe',
      email: 'jane@nforceone.com',
      role: 'EMPLOYEE',
      storeNames: ['Store 1'],
      mustResetPassword: false,
      employeeType: null,
      phone: null,
      avatarUrl: null,
    })
    mockGetSessionStatus.mockResolvedValue({ remainingSeconds: 1800 })

    render(<App />)

    await screen.findByRole('heading', { name: /today's tasks/i })
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument()
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
      employeeType: null,
      phone: null,
      avatarUrl: null,
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
      employeeType: null,
      phone: null,
      avatarUrl: null,
    })

    render(<App />)

    await screen.findByText(/select your store/i)
  })

  it('retries once and keeps the token when the restore check fails transiently (not a 401)', async () => {
    localStorage.setItem(TOKEN_KEY, 'still-valid-token')
    localStorage.setItem(ACTIVE_STORE_KEY, String(STORE_1.id))
    mockGetMe.mockRejectedValueOnce(new Error('The request timed out. Please check your connection and try again.'))
    mockGetMe.mockResolvedValueOnce({
      id: 7,
      fullName: 'Jane Doe',
      email: 'jane@nforceone.com',
      role: 'EMPLOYEE',
      storeNames: ['Store 1', 'Store 2'],
      mustResetPassword: false,
      employeeType: null,
      phone: null,
      avatarUrl: null,
    })

    render(<App />)

    // Recovers on the automatic retry instead of bouncing to Login.
    await screen.findByRole('heading', { name: /today's tasks/i })
    expect(mockGetMe).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(TOKEN_KEY)).toBe('still-valid-token')
  })

  it('falls back to login without clearing the token when the restore check keeps failing transiently', async () => {
    localStorage.setItem(TOKEN_KEY, 'still-valid-token')
    mockGetMe.mockRejectedValue(new Error('The request timed out. Please check your connection and try again.'))

    render(<App />)

    await screen.findByText(/welcome back/i)
    expect(mockGetMe).toHaveBeenCalledTimes(2)
    // Not a confirmed-invalid session -- the token is left in place.
    expect(localStorage.getItem(TOKEN_KEY)).toBe('still-valid-token')
  })
})

describe('store selection', () => {
  it('auto-selects the only assigned store and hides the switch-store control', async () => {
    const user = userEvent.setup()
    mockGetAuthorizedStores.mockResolvedValue([STORE_1])
    mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe', mustResetPassword: false, sessionTimeoutMinutes: 30 })

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
    mockLogin.mockResolvedValueOnce({ token: 'test-token', role: 'EMPLOYEE', fullName: 'Jane Doe', mustResetPassword: false, sessionTimeoutMinutes: 30 })

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

describe('employee tab persistence', () => {
  // Regression test: EmployeeShell keeps every visited tab mounted (display:none
  // when inactive) specifically so switching tabs doesn't refetch. That was being
  // undermined by AppShell's cross-fade wrapper keying its remount-on-change
  // transition off the active tab itself, which force-remounted every already-
  // visited tab (including this one's own missed-tasks call, the most expensive)
  // on every single switch -- see EmployeeShell's contentKey comment.
  it('does not refetch an already-visited tab when switching back to it', async () => {
    // The missed-tasks page has no side-nav entry (see EmployeeShell) -- reach
    // it via the daily checklist's banner instead, which only renders once
    // there's a nonzero missed count.
    mockGetMissedTasks.mockResolvedValue({
      groups: [{ date: '2026-09-20', instances: [] }], nextCursor: null, totalInstances: 3,
    })
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user)
    await selectFirstOpenStore(user)
    expect(mockGetDailyChecklist).toHaveBeenCalledTimes(1)

    await user.click(await screen.findByRole('button', { name: /missed task.*from previous days/i }))
    await screen.findByRole('heading', { name: /missed tasks/i })
    const missedCallsAfterFirstVisit = mockGetMissedTasks.mock.calls.length
    expect(missedCallsAfterFirstVisit).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /checklist/i }))
    await screen.findByRole('heading', { name: /today's tasks/i })

    await user.click(screen.getByRole('button', { name: /missed task.*from previous days/i }))
    await screen.findByRole('heading', { name: /missed tasks/i })

    // Neither tab remounted on the way back, so neither refetched.
    expect(mockGetDailyChecklist).toHaveBeenCalledTimes(1)
    expect(mockGetMissedTasks.mock.calls.length).toBe(missedCallsAfterFirstVisit)
  })

  it('has no side-nav or bottom-tab entry for missed tasks', async () => {
    mockGetMissedTasks.mockResolvedValue({
      groups: [{ date: '2026-09-20', instances: [] }], nextCursor: null, totalInstances: 3,
    })
    const user = userEvent.setup()
    render(<App />)

    await loginAsEmployee(user)
    await selectFirstOpenStore(user)
    await screen.findByRole('heading', { name: /today's tasks/i })

    expect(screen.queryByRole('button', { name: /^missing tasks$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^missed tasks$/i })).not.toBeInTheDocument()
  })
})
