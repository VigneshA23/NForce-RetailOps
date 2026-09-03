import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Profile from './Profile'
import * as meApi from '../api/me'
import * as authApi from '../api/auth'
import type { MeResponse } from '../api/me'

vi.mock('../api/me', () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
  updateAvatar: vi.fn(),
}))

vi.mock('../api/auth', async () => {
  const actual = await vi.importActual<typeof import('../api/auth')>('../api/auth')
  return {
    ...actual,
    changePassword: vi.fn(),
  }
})

vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockGetMe = vi.mocked(meApi.getMe)
const mockUpdateMe = vi.mocked(meApi.updateMe)
const mockChangePassword = vi.mocked(authApi.changePassword)

const ME: MeResponse = {
  id: 1,
  fullName: 'Jane Employee',
  email: 'jane@nforceone.com',
  role: 'EMPLOYEE',
  storeNames: ['Store 1'],
  mustResetPassword: false,
  shift: 'Morning',
  employeeType: 'Full Time',
  phone: '555-0100',
  avatarUrl: null,
}

beforeEach(() => {
  mockGetMe.mockReset()
  mockUpdateMe.mockReset()
  mockChangePassword.mockReset()
  mockGetMe.mockResolvedValue(ME)
})

describe('Profile overview section', () => {
  it('displays name, email, store, and meta from the /me endpoint', async () => {
    render(<Profile initials="JE" />)

    expect(await screen.findByText('Jane Employee')).toBeInTheDocument()
    expect(screen.getByText('jane@nforceone.com')).toBeInTheDocument()
    expect(screen.getByText('Store 1')).toBeInTheDocument()
    expect(screen.getByText(/morning shift/i)).toBeInTheDocument()
  })
})

describe('Profile personal info section', () => {
  it('renders always-editable fields pre-filled with current data', async () => {
    render(<Profile initials="JE" />)

    const nameInput = (await screen.findByLabelText(/full name/i)) as HTMLInputElement
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement
    expect(nameInput.value).toBe('Jane Employee')
    expect(emailInput.value).toBe('jane@nforceone.com')
    expect(phoneInput.value).toBe('555-0100')
  })

  it('saves profile changes and reflects them in the overview on success', async () => {
    mockUpdateMe.mockResolvedValue({ ...ME, fullName: 'Jane Updated' })
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    const nameInput = await screen.findByLabelText(/full name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Jane Updated')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Jane Updated', email: 'jane@nforceone.com' }),
    )
    expect(await screen.findByText('Jane Updated')).toBeInTheDocument()
  })
})

describe('Profile change password section', () => {
  it('is rendered inline — no modal dialog element', async () => {
    render(<Profile initials="JE" />)
    await screen.findByText('Jane Employee')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByLabelText(/current password/i)).toBeInTheDocument()
  })

  it('rejects a mismatched confirmation before submitting', async () => {
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await user.type(await screen.findByLabelText(/current password/i), 'current-pass')
    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-password')
    await user.type(screen.getByLabelText(/confirm new password/i), 'does-not-match')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('calls changePassword and shows success state on correct input', async () => {
    mockChangePassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await user.type(await screen.findByLabelText(/current password/i), 'current-pass')
    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-password')
    await user.type(screen.getByLabelText(/confirm new password/i), 'brand-new-password')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(mockChangePassword).toHaveBeenCalledWith('current-pass', 'brand-new-password')
    expect(await screen.findByText(/password changed successfully/i)).toBeInTheDocument()
  })
})
