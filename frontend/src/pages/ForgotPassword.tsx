import { useState, type FormEvent } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { motion } from 'motion/react'
import { requestPasswordReset } from '../api/auth'
import './LoginCrimson.css'

interface ForgotPasswordProps {
  onBackToSignIn: () => void
}

function ForgotPassword({ onBackToSignIn }: ForgotPasswordProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitHovered, setSubmitHovered] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
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

            <h1 className="login3-heading">Reset Password</h1>
            <span className="login3-heading-underline" aria-hidden="true" />
            <p className="login3-subheading">
              Enter your organizational email. If it's registered, you'll receive reset
              instructions.
            </p>

            {submitted ? (
              <>
                <p className="login3-success" role="status">
                  If an account exists for {email}, reset instructions are on their way.
                </p>
                <p className="login3-access-note">
                  <button type="button" className="login3-forgot-link" onClick={onBackToSignIn}>
                    <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
                  </button>
                </p>
              </>
            ) : (
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
                  {loading ? 'Sending…' : 'Send Reset Instructions'}
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

                <p className="login3-access-note">
                  <button type="button" className="login3-forgot-link" onClick={onBackToSignIn}>
                    <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
                  </button>
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
