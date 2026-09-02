import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Profile from './Profile'
import * as meApi from '../api/me'
import * as authApi from '../api/auth'
import type { MeResponse } from '../api/me'

vi.mock('../api/me', () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
}))

vi.mock('../api/auth', async () => {
  const actual = await vi.importActual<typeof import('../api/auth')>('../api/auth')
  return {
    ...actual,
    changePassword: vi.fn(),
  }
})

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
}

beforeEach(() => {
  mockGetMe.mockReset()
  mockUpdateMe.mockReset()
  mockChangePassword.mockReset()
  mockGetMe.mockResolvedValue(ME)
})

describe('Profile', () => {
  it('displays the logged-in user\'s data, including the mobile field, from the real profile endpoint', async () => {
    render(<Profile initials="JE" />)

    expect(await screen.findByText('Jane Employee')).toBeInTheDocument()
    expect(screen.getByText('jane@nforceone.com')).toBeInTheDocument()
    expect(screen.getByText('555-0100')).toBeInTheDocument()
    expect(screen.getByText('Store 1')).toBeInTheDocument()
  })

  it('opens an editable form pre-filled with the current profile data, and reflects a save immediately', async () => {
    mockUpdateMe.mockResolvedValue({ ...ME, fullName: 'Jane Updated', phone: '555-9999' })
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await user.click(await screen.findByRole('button', { name: /edit profile/i }))

    const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/mobile/i) as HTMLInputElement
    expect(nameInput.value).toBe('Jane Employee')
    expect(phoneInput.value).toBe('555-0100')

    await user.clear(nameInput)
    await user.type(nameInput, 'Jane Updated')
    await user.clear(phoneInput)
    await user.type(phoneInput, '555-9999')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockUpdateMe).toHaveBeenCalledWith({
      fullName: 'Jane Updated',
      email: 'jane@nforceone.com',
      phone: '555-9999',
    })
    // Back to the read-only display, now showing the saved values without a reload.
    expect(await screen.findByText('Jane Updated')).toBeInTheDocument()
    expect(screen.getByText('555-9999')).toBeInTheDocument()
  })

  it('requires a mobile number in the edit form', async () => {
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await user.click(await screen.findByRole('button', { name: /edit profile/i }))
    await user.clear(screen.getByLabelText(/mobile/i))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Mobile number is required')).toBeInTheDocument()
    expect(mockUpdateMe).not.toHaveBeenCalled()
  })
})

describe('Profile "Reset Password" modal', () => {
  it('requires all fields and rejects a mismatched confirmation', async () => {
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await user.click(await screen.findByRole('button', { name: /edit profile/i }))
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Reset Password' }))
    expect(await within(dialog).findByText('Old password is required')).toBeInTheDocument()
    expect(within(dialog).getByText('New password is required')).toBeInTheDocument()
    expect(within(dialog).getByText('Please confirm your new password')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^Old Password/i), 'current-pass')
    await user.type(within(dialog).getByLabelText(/^New Password/i), 'brand-new-password')
    await user.type(within(dialog).getByLabelText(/^Confirm New Password/i), 'does-not-match')
    await user.click(within(dialog).getByRole('button', { name: 'Reset Password' }))

    expect(await within(dialog).findByText('New password and confirmation do not match')).toBeInTheDocument()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('submits the current and new password, and closes on success', async () => {
    mockChangePassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await user.click(await screen.findByRole('button', { name: /edit profile/i }))
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^Old Password/i), 'current-pass')
    await user.type(within(dialog).getByLabelText(/^New Password/i), 'brand-new-password')
    await user.type(within(dialog).getByLabelText(/^Confirm New Password/i), 'brand-new-password')
    await user.click(within(dialog).getByRole('button', { name: 'Reset Password' }))

    expect(mockChangePassword).toHaveBeenCalledWith('current-pass', 'brand-new-password')
    // The modal closes on success; the edit form underneath remains open.
    await screen.findByLabelText(/full name/i)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
