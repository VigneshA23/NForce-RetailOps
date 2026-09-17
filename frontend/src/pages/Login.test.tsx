import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'
import * as authApi from '../api/auth'

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

const mockLogin = vi.mocked(authApi.login)
const mockRequestPasswordReset = vi.mocked(authApi.requestPasswordReset)

beforeEach(() => {
  mockLogin.mockReset()
  mockRequestPasswordReset.mockReset()
})

describe('Login — Remember Me', () => {
  it('renders the Remember Me checkbox, unchecked by default', () => {
    render(<Login onLoginSuccess={vi.fn()} />)

    const checkbox = screen.getByLabelText(/remember me/i)
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('can be checked and unchecked', async () => {
    const user = userEvent.setup()
    render(<Login onLoginSuccess={vi.fn()} />)

    const checkbox = screen.getByLabelText(/remember me/i)
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('sends rememberMe: false to the login API when left unchecked', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'test-token',
      role: 'EMPLOYEE',
      fullName: 'Jane Doe',
      mustResetPassword: false,
      sessionTimeoutMinutes: 30,
    })
    render(<Login onLoginSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).toHaveBeenCalledWith('sneha.patel@kedsicecream.com', 'password123', false)
  })

  it('sends rememberMe: true to the login API when checked', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'test-token',
      role: 'EMPLOYEE',
      fullName: 'Jane Doe',
      mustResetPassword: false,
      sessionTimeoutMinutes: 240,
    })
    render(<Login onLoginSuccess={vi.fn()} />)

    await user.click(screen.getByLabelText(/remember me/i))
    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).toHaveBeenCalledWith('sneha.patel@kedsicecream.com', 'password123', true)
  })

  it('passes the chosen remember value through to onLoginSuccess', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'test-token',
      role: 'EMPLOYEE',
      fullName: 'Jane Doe',
      mustResetPassword: false,
      sessionTimeoutMinutes: 240,
    })
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.click(screen.getByLabelText(/remember me/i))
    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'test-token' }),
      true,
      false,
    ), { timeout: 2000 })
  })
})

describe('Login — email whitespace handling', () => {
  it('logs in normally when the email has no leading/trailing whitespace', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'test-token',
      role: 'EMPLOYEE',
      fullName: 'Jane Doe',
      mustResetPassword: false,
      sessionTimeoutMinutes: 30,
    })
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).toHaveBeenCalledWith('sneha.patel@kedsicecream.com', 'password123', false)
  })

  it('rejects a leading space in the email without calling the login API', async () => {
    const user = userEvent.setup()
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText(/email/i), ' sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).not.toHaveBeenCalled()
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('rejects multiple leading spaces in the email without calling the login API', async () => {
    const user = userEvent.setup()
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText(/email/i), '      sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).not.toHaveBeenCalled()
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('rejects a trailing space in the email without calling the login API', async () => {
    const user = userEvent.setup()
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com ')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).not.toHaveBeenCalled()
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('rejects leading and trailing spaces in the email without calling the login API', async () => {
    const user = userEvent.setup()
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText(/email/i), ' sneha.patel@kedsicecream.com ')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).not.toHaveBeenCalled()
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('does not alter a password value when the email is valid', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'test-token',
      role: 'EMPLOYEE',
      fullName: 'Jane Doe',
      mustResetPassword: false,
      sessionTimeoutMinutes: 30,
    })
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), '  spaced password  ')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).toHaveBeenCalledWith('sneha.patel@kedsicecream.com', '  spaced password  ', false)
  })

  it('still shows the generic error for genuinely invalid credentials', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'))
    const onLoginSuccess = vi.fn()
    render(<Login onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).toHaveBeenCalledWith('sneha.patel@kedsicecream.com', 'wrong-password', false)
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })
})

describe('Forgot Password — email whitespace handling', () => {
  async function openForgotPasswordView(user: ReturnType<typeof userEvent.setup>) {
    render(<Login onLoginSuccess={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /forgot password\?/i }))
    // Wait for the forgot-password form to actually mount (AnimatePresence
    // exit/enter transition) before interacting with its fields — otherwise
    // getByLabelText can still resolve the sign-in form's stale email input.
    await screen.findByRole('button', { name: /send reset instructions/i })
  }

  it('rejects a leading/trailing whitespace email without calling requestPasswordReset', async () => {
    const user = userEvent.setup()
    await openForgotPasswordView(user)

    await user.type(screen.getByLabelText(/email/i), ' sneha.patel@kedsicecream.com ')
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }))

    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })

  it('submits a clean email normally', async () => {
    const user = userEvent.setup()
    mockRequestPasswordReset.mockResolvedValueOnce(undefined)
    await openForgotPasswordView(user)

    await user.type(screen.getByLabelText(/email/i), 'sneha.patel@kedsicecream.com')
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }))

    expect(mockRequestPasswordReset).toHaveBeenCalledWith('sneha.patel@kedsicecream.com')
  })
})
