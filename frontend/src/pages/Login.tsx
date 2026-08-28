import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  const [focused, setFocused] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleDocumentMouseDown)
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown)
  }, [])

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
    <div className={`login2-shell${focused ? ' login2-shell--focused' : ''}`}>
      <div className="login2-bg" aria-hidden="true">
        <div className="login2-bg-layer login2-bg-layer--primary" />
        <div className="login2-bg-layer login2-bg-layer--secondary" />
      </div>

      <div className="login2-left">
        <div className="login2-brand">
          <span className="login2-brandmark">
            <img src="/nforce-logo.png" alt="NForce logo" className="login2-brandmark-img" />
          </span>
          <div>
            <div className="login2-brand-title">NFORCE RetailOps</div>
            <div className="login2-brand-subtitle">Store &amp; Operations Platform</div>
          </div>
        </div>

        <div className="login2-hero">
          <h1>
            Your stores. <span className="login2-hero-accent">One checklist.</span>
          </h1>
          <p>
            Opening, prep, cleaning and closing across every location — recorded in order, signed
            off by the person on shift, and auditable the next morning. No paper, no group chats.
          </p>

          <div className="login2-divider" />

          <div className="login2-features">
            <div className="login2-feature">
              <span className="login2-feature-dot" />
              <h3>Sequential Workflows</h3>
              <p>Tasks unlock in order to ensure operational safety.</p>
            </div>
            <div className="login2-feature">
              <span className="login2-feature-dot" />
              <h3>Full Audit Trail</h3>
              <p>Every completion and owner correction is tracked.</p>
            </div>
            <div className="login2-feature">
              <span className="login2-feature-dot" />
              <h3>Multi-Store Oversight</h3>
              <p>Manage all locations from a single dashboard.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login2-right">
        <div className="login2-card" ref={cardRef} onClick={() => setFocused(true)}>
          <div className="login2-card-glow" aria-hidden="true" />

          <img src="/nforce-logo.png" alt="NForce logo" className="login2-mobile-logo" />

          <h2 className="login2-card-heading">Welcome to RetailOps</h2>
          <p className="login2-card-subheading">Command &amp; Control at your fingertips.</p>

          {notice && <div className="login2-error" role="status">{notice}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="login2-field">
              <label htmlFor="email" className="login2-label">
                Email Address
              </label>
              <div className="login2-input-wrap">
                <Mail size={16} className="login2-input-icon" />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="user@creamcove.com"
                  className="login2-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                />
              </div>
            </div>

            <div className="login2-field">
              <div className="login2-field-row">
                <label htmlFor="password" className="login2-label">
                  Password
                </label>
                <button type="button" className="login2-forgot-link" onClick={onForgotPassword}>
                  Forgot Password?
                </button>
              </div>
              <div className="login2-input-wrap">
                <Lock size={16} className="login2-input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="login2-input login2-input--password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused(true)}
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

            {error && <div className="login2-error">{error}</div>}

            <button type="submit" className="login2-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="login2-mobile-tagline">Your stores. One checklist.</p>
      </div>
    </div>
  )
}

export default Login
