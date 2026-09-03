import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { confirmPasswordReset } from '../api/auth'
import './LoginCrimson.css'

interface SetNewPasswordProps {
  token: string
  onDone: () => void
}

function SetNewPassword({ token, onDone }: SetNewPasswordProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= 8 && !mismatch && !loading

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      await confirmPasswordReset(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
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

            <h1 className="login3-heading">Set New Password</h1>
            <span className="login3-heading-underline" aria-hidden="true" />

            {success ? (
              <>
                <p className="login3-success" role="status">
                  Password updated. You can now sign in with your new password.
                </p>
                <motion.button
                  type="button"
                  className="login3-submit"
                  onClick={onDone}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Go to Sign In
                </motion.button>
              </>
            ) : (
              <>
                <p className="login3-subheading">Choose a strong password of at least 8 characters.</p>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="login3-field">
                    <span className="login3-label-row">
                      <label htmlFor="snp-password" className="login3-label">
                        New Password
                      </label>
                      <span className="login3-label-required" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <div className="login3-input-wrap">
                      <Lock size={16} className="login3-input-icon" aria-hidden="true" />
                      <input
                        id="snp-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
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
                    {tooShort && (
                      <p className="login3-error" style={{ marginTop: 4, marginBottom: 0 }}>
                        At least 8 characters required.
                      </p>
                    )}
                  </div>

                  <div className="login3-field">
                    <span className="login3-label-row">
                      <label htmlFor="snp-confirm" className="login3-label">
                        Confirm Password
                      </label>
                      <span className="login3-label-required" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <div className="login3-input-wrap">
                      <Lock size={16} className="login3-input-icon" aria-hidden="true" />
                      <input
                        id="snp-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        className="login3-input"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label={showConfirm ? 'Hide confirm' : 'Show confirm'}
                        className="login3-toggle-visibility"
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {mismatch && (
                      <p className="login3-error" style={{ marginTop: 4, marginBottom: 0 }}>
                        Passwords do not match.
                      </p>
                    )}
                  </div>

                  {error && <div className="login3-error">{error}</div>}

                  <motion.button
                    type="submit"
                    className="login3-submit"
                    disabled={!canSubmit}
                    whileHover={{ scale: canSubmit ? 1.01 : 1 }}
                    whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                  >
                    {loading ? 'Saving…' : 'Set New Password'}
                  </motion.button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default SetNewPassword
