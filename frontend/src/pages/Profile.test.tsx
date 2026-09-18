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
  phone: '+1 5550100',
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

    // Name appears in both the <h2> header and the read-only field row — find by heading role.
    expect(await screen.findByRole('heading', { name: 'Jane Employee' })).toBeInTheDocument()
    // Email appears in the identity meta span and in the read-only personal info row.
    expect((await screen.findAllByText('jane@nforceone.com')).length).toBeGreaterThan(0)
    expect(screen.getByText('Store 1')).toBeInTheDocument()
    expect(screen.getByText(/morning shift/i)).toBeInTheDocument()
  })
})

describe('Profile personal info section', () => {
  it('renders editable fields pre-filled with current data when edit mode is opened', async () => {
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    // Wait for data to load, then open the edit form.
    await screen.findByRole('heading', { name: 'Jane Employee' })
    await user.click(screen.getByRole('button', { name: /edit personal info/i }))

    const nameInput = (await screen.findByLabelText(/full name/i)) as HTMLInputElement
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement
    expect(nameInput.value).toBe('Jane Employee')
    expect(emailInput.value).toBe('jane@nforceone.com')
    expect(phoneInput.value).toBe('5550100')
  })

  it('saves profile changes and reflects them in the overview on success', async () => {
    mockUpdateMe.mockResolvedValue({ ...ME, fullName: 'Jane Updated' })
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await screen.findByRole('heading', { name: 'Jane Employee' })
    await user.click(screen.getByRole('button', { name: /edit personal info/i }))

    const nameInput = await screen.findByLabelText(/full name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Jane Updated')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Jane Updated', email: 'jane@nforceone.com' }),
    )
    expect(await screen.findByRole('heading', { name: 'Jane Updated' })).toBeInTheDocument()
  })

  // Regression: the phone field used to be a single plain-digit input with no
  // country-code awareness, so a phone stored as "+1 5550100" (the format the
  // Add/Edit Employee form writes) got its "+"/space stripped and its leading
  // "1" merged into the 10-digit slot on the very first edit, permanently
  // losing the real last digit on save.
  it('keeps the country code separate from the phone number on save, unmerged', async () => {
    mockUpdateMe.mockResolvedValue({ ...ME })
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await screen.findByRole('heading', { name: 'Jane Employee' })
    await user.click(screen.getByRole('button', { name: /edit personal info/i }))

    const phoneInput = (await screen.findByLabelText(/phone/i)) as HTMLInputElement
    expect(phoneInput.value).toBe('5550100')
    await user.type(phoneInput, '99')
    expect(phoneInput.value).toBe('555010099')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+1 555010099' }),
    )
  })
})

describe('Profile personal info section — Owner/Admin and Super Admin phone', () => {
  // Owners/Super Admins have no country-code dropdown anywhere in the app
  // (see OwnerFormModal's plain 10-digit "Contact" field) -- their phone is
  // stored as bare digits, so the field must not run it through the
  // country-code parser (that would misread leading digits as a country
  // code and drop the real last digit on save).
  it.each([
    ['OWNER_ADMIN' as const, 'Olivia Owner'],
    ['SUPER_ADMIN' as const, 'Sam Admin'],
  ])('edits and saves a plain 10-digit phone with no country code, for %s', async (role, fullName) => {
    const me = { ...ME, role, fullName, storeNames: [], shift: null, employeeType: null, phone: '5550100' }
    mockGetMe.mockResolvedValue(me)
    mockUpdateMe.mockResolvedValue({ ...me })
    const user = userEvent.setup()
    render(<Profile initials="OA" />)

    await screen.findByRole('heading', { name: fullName })
    await user.click(screen.getByRole('button', { name: /edit personal info/i }))

    const phoneInput = (await screen.findByLabelText(/phone/i)) as HTMLInputElement
    expect(phoneInput.value).toBe('5550100')
    expect(screen.queryByLabelText(/country code/i)).not.toBeInTheDocument()

    await user.type(phoneInput, '99')
    expect(phoneInput.value).toBe('555010099')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mockUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '555010099' }),
    )
  })
})

describe('Profile change password section', () => {
  it('expands inline when "Change password" is clicked — no modal dialog', async () => {
    const user = userEvent.setup()
    render(<Profile initials="JE" />)
    await screen.findByRole('heading', { name: 'Jane Employee' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects a mismatched confirmation before submitting', async () => {
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await screen.findByRole('heading', { name: 'Jane Employee' })
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await user.type(await screen.findByLabelText(/current password/i), 'current-pass')
    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-password')
    await user.type(screen.getByLabelText(/confirm new password/i), 'does-not-match')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it('calls changePassword and shows success state on correct input', async () => {
    mockChangePassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Profile initials="JE" />)

    await screen.findByRole('heading', { name: 'Jane Employee' })
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await user.type(await screen.findByLabelText(/current password/i), 'current-pass')
    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-password')
    await user.type(screen.getByLabelText(/confirm new password/i), 'brand-new-password')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(mockChangePassword).toHaveBeenCalledWith('current-pass', 'brand-new-password', false)
    // On success the form collapses — the current-password input disappears.
    await screen.findByRole('button', { name: /change password/i })
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument()
  })
})
