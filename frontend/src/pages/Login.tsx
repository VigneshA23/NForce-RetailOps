import { useState, type FormEvent } from 'react'
import {
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react'
import { login } from '../api/auth'
import type { AuthUser } from '../types/auth'
import './LoginWhite.css'

interface LoginProps {
  onLoginSuccess: (user: AuthUser, remember: boolean, mustResetPassword: boolean) => void
  onForgotPassword: () => void
  notice?: string | null
}

function Login({ onLoginSuccess, onForgotPassword, notice }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await login(email, password)
      onLoginSuccess(result, rememberMe, result.mustResetPassword)
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loginw-shell">
      <div className="loginw-form-col">
        <div className="loginw-form-wrap">
          <div className="loginw-mobile-decor" aria-hidden="true">
            <span className="loginw-mobile-chip loginw-mobile-chip--store">
              <ClipboardList size={18} strokeWidth={1.75} />
            </span>
            <span className="loginw-mobile-chip loginw-mobile-chip--gift">
              <Bell size={16} strokeWidth={1.75} />
            </span>
          </div>

          <div className="loginw-form-card">
            <div className="loginw-brand">
              <span className="loginw-brand-logo-ring">
                <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="loginw-brand-logo" />
              </span>
              <span className="loginw-brand-name">NForce RetailOps</span>
            </div>

            <h1 className="loginw-heading">Welcome back</h1>
            <p className="loginw-subheading">Please enter your details to sign in</p>

            {notice && (
              <div className="loginw-notice" role="status">
                {notice}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
            <div className="loginw-field">
              <label htmlFor="email" className="loginw-label">
                Email address
              </label>
              <div className="loginw-input-wrap">
                <Mail size={16} className="loginw-input-icon" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@nforceone.com"
                  className="loginw-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="loginw-field">
              <label htmlFor="password" className="loginw-label">
                Password
              </label>
              <div className="loginw-input-wrap">
                <Lock size={16} className="loginw-input-icon" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="loginw-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="loginw-toggle-visibility"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="loginw-meta-row">
              <label className="loginw-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button type="button" className="loginw-forgot-link" onClick={onForgotPassword}>
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="loginw-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="loginw-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            </form>
          </div>

          <div className="loginw-mobile-copy">
            <h2>Your stores. One checklist.</h2>
            <p>Run daily checklists, audits, and store operations from one place.</p>
          </div>
        </div>
      </div>

      <div className="loginw-art-col" aria-hidden="true">
        <div className="loginw-art">
          <div className="loginw-art-ring" />

          <div className="loginw-phone">
            <div className="loginw-phone-awning">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className={i % 2 === 0 ? 'loginw-awning-red' : 'loginw-awning-white'} />
              ))}
            </div>
            <div className="loginw-phone-screen">
              <div className="loginw-phone-badge">
                <Check size={26} strokeWidth={3} />
              </div>
            </div>
            <div className="loginw-phone-home" />
          </div>

          <div className="loginw-float loginw-float--store">
            <Store size={22} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--cart-sm">
            <Calendar size={18} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--gift">
            <ClipboardList size={26} strokeWidth={1.5} />
          </div>
          <div className="loginw-float loginw-float--discount">
            <Bell size={22} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--bag-top">
            <ShieldCheck size={24} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--basket">
            <DollarSign size={22} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--cart-lg">
            <Users size={24} strokeWidth={1.5} />
          </div>
          <div className="loginw-float loginw-float--bag-bottom">
            <ClipboardCheck size={20} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--dollar-sm">
            <Users size={16} strokeWidth={2} />
          </div>
          <div className="loginw-float loginw-float--dollar-lg">
            <ClipboardCheck size={24} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--store-tag">Store</div>
          <div className="loginw-float loginw-float--globe">
            <CalendarCheck size={20} strokeWidth={1.75} />
          </div>
          <div className="loginw-float loginw-float--percent">
            <ShoppingCart size={20} strokeWidth={1.75} />
          </div>
        </div>

        <div className="loginw-art-copy">
          <h2>Your stores. One checklist.</h2>
          <p>Run daily checklists, audits, and store operations from one place.</p>
        </div>
      </div>
    </div>
  )
}

export default Login
