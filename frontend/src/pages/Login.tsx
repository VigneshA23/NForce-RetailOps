import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { motion } from 'motion/react'
import { login } from '../api/auth'
import type { AuthUser, Role } from '../types/auth'
import { getLastKnownRole } from '../utils/authStorage'
import './LoginCrimson.css'

interface LoginProps {
  onLoginSuccess: (user: AuthUser, remember: boolean, mustResetPassword: boolean) => void
  onForgotPassword: () => void
  notice?: string | null
}

// Who each role should be pointed to for help. The role is only known once a
// user has actually authenticated in this browser before (see
// authStorage.getLastKnownRole) -- the login page itself has no way to know
// who's about to sign in, and must not guess from the email being typed.
const ASSISTANCE_CONTACT: Record<Role, string> = {
  SUPER_ADMIN: 'Contact your support team',
  OWNER_ADMIN: 'Contact your Super Admin',
  EMPLOYEE: 'Contact your Owner/Admin',
}

function assistanceMessage(): string {
  const role = getLastKnownRole() as Role | null
  return (role && ASSISTANCE_CONTACT[role]) || 'Contact your admin'
}

function Login({ onLoginSuccess, onForgotPassword, notice }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitHovered, setSubmitHovered] = useState(false)

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
    <div className="login3-shell">
      <div className="login3-bg-photo" aria-hidden="true" />
      <div className="login3-bg-overlay" aria-hidden="true" />
      <div className="login3-grid">
        <div className="login3-hero">
          <motion.div
            className="login3-hero-brand"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login3-hero-logo" />
            <span className="login3-hero-wordmark">NForce RetailOps</span>
          </motion.div>
          <motion.div
            className="login3-hero-text"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
          >
            <h2 className="login3-hero-heading">
              Your stores. <span className="login3-hero-accent">One checklist.</span>
            </h2>
          </motion.div>
        </div>

        <div className="login3-panel">
          <motion.div
            className="login3-panel-inner"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="login3-mobile-brand">
              <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login3-mobile-logo" />
              <p className="login3-mobile-wordmark">NForce RetailOps</p>
            </div>

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
                <span className="login3-label-row">
                  <label htmlFor="email" className="login3-label">
                    Email
                  </label>
                  <span className="login3-label-required" aria-hidden="true">
                    *
                  </span>
                </span>
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
                <span className="login3-label-row">
                  <label htmlFor="password" className="login3-label">
                    Password
                  </label>
                  <span className="login3-label-required" aria-hidden="true">
                    *
                  </span>
                </span>
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
                <label className="login3-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
                <button type="button" className="login3-forgot-link" onClick={onForgotPassword}>
                  Forgot Password?
                </button>
              </div>

              {error && <div className="login3-error">{error}</div>}

              <motion.button
                type="submit"
                className="login3-submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onHoverStart={() => setSubmitHovered(true)}
                onHoverEnd={() => setSubmitHovered(false)}
              >
                {loading ? 'Signing in…' : 'Sign In'}
                {submitHovered && !loading && (
                  <motion.span
                    className="login3-submit-shimmer"
                    initial={{ left: '-20%' }}
                    animate={{ left: '120%' }}
                    transition={{ duration: 1, ease: 'easeInOut' }}
                    aria-hidden="true"
                  />
                )}
              </motion.button>
            </form>

            <p className="login3-access-note">
              Need assistance? <span className="login3-access-link">{assistanceMessage()}</span>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Login
