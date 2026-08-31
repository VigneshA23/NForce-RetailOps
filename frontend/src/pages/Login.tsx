import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
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
    <div className="login3-shell">
      <div className="login3-grid">
        <div className="login3-hero">
          <div className="login3-hero-glow" aria-hidden="true" />
          <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login3-hero-logo" />
          <div className="login3-hero-text">
            <h2 className="login3-hero-heading">
              Your stores. <span className="login3-hero-accent">One checklist.</span>
            </h2>
            <p className="login3-hero-copy">
              Opening, prep, cleaning and closing across every location — recorded in order,
              signed off by the person on shift, and auditable the next morning. No paper, no
              group chats.
            </p>
          </div>
        </div>

        <div className="login3-panel">
          <div className="login3-panel-inner">
            <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login3-mobile-logo" />

            <h1 className="login3-heading">Welcome Back</h1>
            <span className="login3-heading-underline" aria-hidden="true" />
            <p className="login3-subheading">Sign in to access RetailOps</p>

            {notice && (
              <div className="login3-error" role="status">
                {notice}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="login3-field">
                <label htmlFor="email" className="login3-label">
                  Email
                </label>
                <div className="login3-input-wrap">
                  <Mail size={16} className="login3-input-icon" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@nforceone.com"
                    className="login3-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="login3-field">
                <label htmlFor="password" className="login3-label">
                  Password
                </label>
                <div className="login3-input-wrap">
                  <Lock size={16} className="login3-input-icon" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="login3-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="login3-toggle-visibility"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="login3-meta-row">
                <button type="button" className="login3-forgot-link" onClick={onForgotPassword}>
                  Forgot Password?
                </button>
              </div>

              {error && <div className="login3-error">{error}</div>}

              <button type="submit" className="login3-submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="login3-tagline">Your stores. One checklist.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
