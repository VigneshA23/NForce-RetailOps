import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '../api/auth'
import type { AuthUser } from '../types/auth'
import AuthBrandPanel from '../components/AuthBrandPanel'
import AuthMobileBrand from '../components/AuthMobileBrand'
import './Login.css'

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void
  onForgotPassword: () => void
}

function Login({ onLoginSuccess, onForgotPassword }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(email, password)
      onLoginSuccess(user)
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <AuthBrandPanel
        heading="Your stores. One place."
        description="Manage daily checklists, inventory, and cash reconciliation across every store — without paper forms or manual follow-ups."
        showFeatures
      />

      <div className="login-right">
        <AuthMobileBrand />
        <div className="login-form-wrap">
          <h1 className="login-heading">Welcome back</h1>

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="email" className="login-label">
                Email
              </label>
              <input
                id="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                placeholder="you@nforceone.com"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="login-field">
              <label htmlFor="password" className="login-label">
                Password
              </label>
              <div className="login-input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="login-input login-input--password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="login-toggle-visibility"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="login-forgot-row">
              <button type="button" className="login-forgot-link" onClick={onForgotPassword}>
                Forgot password?
              </button>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
