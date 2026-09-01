import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { completePasswordReset } from '../api/auth'
import './LoginCrimson.css'

interface ResetPasswordRequiredProps {
  onSuccess: () => void
  onLogout: () => void
  loggingOut?: boolean
}

function ResetPasswordRequired({ onSuccess, onLogout, loggingOut }: ResetPasswordRequiredProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (newPassword.trim().length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await completePasswordReset(newPassword.trim())
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password. Please try again.')
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
          <motion.img
            src="/nforce-logo.png"
            alt="NForce RetailOps logo"
            className="login3-hero-logo"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          />
          <motion.div
            className="login3-hero-text"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
          >
            <h2 className="login3-hero-heading">
              Almost there. <span className="login3-hero-accent">Set your password.</span>
            </h2>
            <p className="login3-hero-copy">
              You're signing in with a temporary password. Choose a new one to finish setting up your account.
            </p>
          </motion.div>
        </div>

        <div className="login3-panel">
          <motion.div
            className="login3-panel-inner"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login3-mobile-logo" />
            <p className="login3-mobile-wordmark">RetailOps</p>

            <h1 className="login3-heading">Set a New Password</h1>
            <span className="login3-heading-underline" aria-hidden="true" />
            <p className="login3-subheading">This is your first sign-in — choose a permanent password to continue</p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="login3-field">
                <span className="login3-label-row">
                  <label htmlFor="new-password" className="login3-label">
                    New Password
                  </label>
                  <span className="login3-label-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <div className="login3-input-wrap">
                  <Lock size={16} className="login3-input-icon" aria-hidden="true" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="login3-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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

              <div className="login3-field">
                <span className="login3-label-row">
                  <label htmlFor="confirm-password" className="login3-label">
                    Confirm Password
                  </label>
                  <span className="login3-label-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <div className="login3-input-wrap">
                  <Lock size={16} className="login3-input-icon" aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    className="login3-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && <div className="login3-error">{error}</div>}

              <motion.button
                type="submit"
                className="login3-submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? 'Saving…' : 'Set Password & Continue'}
              </motion.button>
            </form>

            <p className="login3-access-note">
              <button type="button" className="login3-forgot-link" onClick={onLogout} disabled={loggingOut}>
                {loggingOut ? 'Signing out…' : 'Sign out instead'}
              </button>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordRequired
