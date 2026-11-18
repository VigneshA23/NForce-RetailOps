import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as authApi from './api/auth'
import * as storesApi from './api/stores'
import * as meApi from './api/me'
import { authHeaders } from './utils/authStorage'
import { STORE_SCOPE_INVALID_EVENT } from './utils/storeScope'
import type { StoreSummary } from './types/store'

// Owner/Admin store selection: 0 stores -> empty state, 1 -> straight to the
// dashboard, 2+ -> picker first; Switch Store; and recovery when the selected
// store is revoked mid-session.

const TOKEN_KEY = 'nforce-retailops-auth-token'
const OWNER_STORE_KEY = 'nforce-retailops-owner-store'

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  getSessionConfig: vi.fn(),
  getSessionStatus: vi.fn(),
}))

vi.mock('./api/stores', () => ({
  getAuthorizedStores: vi.fn(),
  getOwnerAssignedStores: vi.fn(),
}))

vi.mock('./api/me', () => ({
  getMe: vi.fn(),
}))

vi.mock('./api/inventoryUnits', () => ({
  getInventoryUnits: vi.fn().mockResolvedValue([]),
}))

// The dashboard itself is covered elsewhere; this probe shows which store it was
// given, what X-Store-Id its requests would carry, and exposes Switch Store.
vi.mock('./layouts/DashboardShell', () => ({
  default: (props: { store: StoreSummary; stores: StoreSummary[]; onSwitchStore: () => void }) => (
    <div>
      <h1>Dashboard for {props.store.name}</h1>
      <span data-testid="store-header">{authHeaders()['X-Store-Id'] ?? 'none'}</span>
      {props.stores.length > 1 && (
        <button type="button" onClick={props.onSwitchStore}>
          Switch Store
        </button>
      )}
    </div>
  ),
}))

const mockGetOwnerStores = vi.mocked(storesApi.getOwnerAssignedStores)
const mockGetMe = vi.mocked(meApi.getMe)

const NORTH: StoreSummary = { id: 11, name: 'North', location: 'Main St', status: 'Open' }
const SOUTH: StoreSummary = { id: 12, name: 'South', location: 'Oak Ave', status: 'Open' }

function signedInOwner() {
  sessionStorage.setItem(TOKEN_KEY, 'owner-token')
  mockGetMe.mockResolvedValue({
    id: 5,
    fullName: 'Olivia Owner',
    email: 'olivia@nforce.test',
    role: 'OWNER_ADMIN',
    storeNames: [],
    mustResetPassword: false,
    employeeType: null,
    phone: null,
    avatarUrl: null,
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.mocked(authApi.getSessionConfig).mockResolvedValue({ inactivityTimeoutMinutes: 10, rememberMeTimeoutMinutes: 240 })
  vi.mocked(authApi.getSessionStatus).mockResolvedValue({ remainingSeconds: 600 })
  vi.mocked(authApi.logout).mockResolvedValue(undefined)
  mockGetOwnerStores.mockReset()
  mockGetMe.mockReset()
})

describe('Owner/Admin store selection', () => {
  it('shows the No store assigned empty state to an admin with no stores', async () => {
    signedInOwner()
    mockGetOwnerStores.mockResolvedValue([])

    render(<App />)

    expect(await screen.findByRole('heading', { name: /no store assigned yet/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /dashboard for/i })).not.toBeInTheDocument()
  })

  it('takes an admin with exactly one store straight to the dashboard, scoped to it', async () => {
    signedInOwner()
    mockGetOwnerStores.mockResolvedValue([NORTH])

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Dashboard for North' })).toBeInTheDocument()
    expect(screen.queryByText(/select your store/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('store-header')).toHaveTextContent(String(NORTH.id))
    expect(screen.queryByRole('button', { name: 'Switch Store' })).not.toBeInTheDocument()
  })

  it('makes an admin with several stores pick one before reaching the dashboard', async () => {
    signedInOwner()
    mockGetOwnerStores.mockResolvedValue([NORTH, SOUTH])
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText(/select your store/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /dashboard for/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /south/i }))

    expect(await screen.findByRole('heading', { name: 'Dashboard for South' })).toBeInTheDocument()
    expect(screen.getByTestId('store-header')).toHaveTextContent(String(SOUTH.id))
    expect(sessionStorage.getItem(OWNER_STORE_KEY)).toBe(String(SOUTH.id))
  })

  it('Switch Store returns to the picker, drops the old store, and scopes to the new one', async () => {
    signedInOwner()
    sessionStorage.setItem(OWNER_STORE_KEY, String(NORTH.id))
    mockGetOwnerStores.mockResolvedValue([NORTH, SOUTH])
    const user = userEvent.setup()

    render(<App />)
    await screen.findByRole('heading', { name: 'Dashboard for North' })

    await user.click(screen.getByRole('button', { name: 'Switch Store' }))

    expect(await screen.findByText(/select your store/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /dashboard for north/i })).not.toBeInTheDocument()
    expect(sessionStorage.getItem(OWNER_STORE_KEY)).toBeNull()
    expect(authHeaders()['X-Store-Id']).toBeUndefined()

    await user.click(screen.getByRole('button', { name: /south/i }))
    expect(await screen.findByRole('heading', { name: 'Dashboard for South' })).toBeInTheDocument()
    expect(screen.getByTestId('store-header')).toHaveTextContent(String(SOUTH.id))
  })

  it('restores the remembered store on reload only while the admin is still linked to it', async () => {
    signedInOwner()
    sessionStorage.setItem(OWNER_STORE_KEY, String(SOUTH.id))
    mockGetOwnerStores.mockResolvedValue([NORTH, SOUTH])

    const { unmount } = render(<App />)
    expect(await screen.findByRole('heading', { name: 'Dashboard for South' })).toBeInTheDocument()
    unmount()

    // Remembered store no longer linked: the picker, not a stale dashboard.
    sessionStorage.setItem(OWNER_STORE_KEY, '999')
    render(<App />)
    expect(await screen.findByText(/select your store/i)).toBeInTheDocument()
  })

  it('sends the admin back to the picker with a message when the selected store is revoked', async () => {
    signedInOwner()
    sessionStorage.setItem(OWNER_STORE_KEY, String(SOUTH.id))
    const third: StoreSummary = { id: 13, name: 'East', location: null, status: 'Open' }
    mockGetOwnerStores.mockResolvedValueOnce([NORTH, SOUTH, third])

    render(<App />)
    await screen.findByRole('heading', { name: 'Dashboard for South' })

    // The backend has unassigned South: the next list no longer has it.
    mockGetOwnerStores.mockResolvedValue([NORTH, third])
    act(() => {
      window.dispatchEvent(new Event(STORE_SCOPE_INVALID_EVENT))
    })

    expect(await screen.findByText(/select your store/i)).toBeInTheDocument()
    expect(screen.getAllByText('You no longer have access to that store.').length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: /dashboard for south/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /south/i })).not.toBeInTheDocument()
    expect(sessionStorage.getItem(OWNER_STORE_KEY)).toBeNull()
  })

  it('shows the empty state with a message when the revoked store was the last one', async () => {
    signedInOwner()
    mockGetOwnerStores.mockResolvedValueOnce([NORTH])

    render(<App />)
    await screen.findByRole('heading', { name: 'Dashboard for North' })

    mockGetOwnerStores.mockResolvedValue([])
    act(() => {
      window.dispatchEvent(new Event(STORE_SCOPE_INVALID_EVENT))
    })

    expect(await screen.findByRole('heading', { name: /no store assigned yet/i })).toBeInTheDocument()
    expect(screen.getAllByText('You no longer have access to that store.').length).toBeGreaterThan(0)
  })
})
