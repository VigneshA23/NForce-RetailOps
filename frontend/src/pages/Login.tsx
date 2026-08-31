import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { login } from '../api/auth'
import type { AuthUser } from '../types/auth'
import './LoginCrimson.css'

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void
  onForgotPassword: () => void
  notice?: string | null
}

function Login({ onLoginSuccess, onForgotPassword, notice }: LoginProps) {
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
    <div className="login2-shell">
      <div className="login2-bg" aria-hidden="true" />

      <div className="login2-card">
        <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login2-logo" />

        <h1 className="login2-heading">
          Login Here <ArrowRight size={18} aria-hidden="true" />
        </h1>

        {notice && (
          <div className="login2-error" role="status">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="login2-field">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <div className="login2-input-wrap">
              <Mail size={16} className="login2-input-icon" aria-hidden="true" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email"
                className="login2-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="login2-field">
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <div className="login2-input-wrap">
              <Lock size={16} className="login2-input-icon" aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                className="login2-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="login2-toggle-visibility"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="login2-meta-row">
            <button type="button" className="login2-forgot-link" onClick={onForgotPassword}>
              Forgot Password?
            </button>
          </div>

          {error && <div className="login2-error">{error}</div>}

          <div className="login2-submit-row">
            <button
              type="submit"
              className="login2-submit"
              disabled={loading}
              aria-label={loading ? 'Signing in' : 'Sign in'}
            >
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>

      <p className="login2-footer">© {new Date().getFullYear()} NForce RetailOps. All rights reserved.</p>
    </div>
  )
}

export default Login
