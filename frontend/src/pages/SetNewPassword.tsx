import { useState, useCallback, type FormEvent } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'motion/react'
import { confirmPasswordReset } from '../api/auth'
import LoginHeroPanel from '../components/LoginHeroPanel'
import ButtonDots from '../components/ButtonDots'
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

  const prefersReducedMotion = useReducedMotion()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-200, 200], [3, -3])
  const rotateY = useTransform(mouseX, [-200, 200], [-3, 3])

  const onCardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return
      const rect = e.currentTarget.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left - rect.width / 2)
      mouseY.set(e.clientY - rect.top - rect.height / 2)
    },
    [prefersReducedMotion, mouseX, mouseY],
  )

  const onCardMouseLeave = useCallback(() => {
    animate(mouseX, 0, { type: 'spring', stiffness: 260, damping: 28 })
    animate(mouseY, 0, { type: 'spring', stiffness: 260, damping: 28 })
  }, [mouseX, mouseY])

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
      <div className="login3-bg-overlay" aria-hidden="true" />

      <div className="login3-grid">
        <div className="login3-hero login3-hero--illustrated">
          <LoginHeroPanel />
        </div>

        <div className="login3-panel">
          <div className="nf1-card-wrap" style={{ perspective: '1200px' }}>
            <motion.div
              className="nf1-tilt-wrapper"
              style={!prefersReducedMotion ? { rotateX, rotateY } : undefined}
              onMouseMove={onCardMouseMove}
              onMouseLeave={onCardMouseLeave}
              whileHover={!prefersReducedMotion ? { z: 4 } : undefined}
            >
              {!prefersReducedMotion && (
                <motion.div
                  className="nf1-card-glow"
                  animate={{ opacity: [0.35, 0.75, 0.35] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden="true"
                />
              )}

              <motion.div
                className="login3-panel-inner"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 0.84, 0.3, 1] }}
              >
                <div className="nf1-card-highlight" aria-hidden="true" />

                <div className="login3-mobile-brand">
                  <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login3-mobile-logo" />
                  <p className="login3-mobile-wordmark">NForce RetailOps</p>
                  <span className="login3-mobile-tagline">
                    Your stores.{' '}
                    <span className="login3-mobile-tagline-accent">One checklist.</span>
                  </span>
                </div>

                <div className="nf1-card-header">
                  <img src="/nforce-logo.png" alt="" className="nf1-card-logo" aria-hidden="true" />
                  <span className="nf1-card-wordmark">NForce RetailOps</span>
                </div>

                <h1 className="login3-heading">Set Up Your Account</h1>
                <span className="login3-heading-underline" aria-hidden="true" />

                {success ? (
                  <>
                    <p className="login3-success" role="status">
                      Password set. You can now sign in with your new password.
                    </p>
                    <div className="nf1-btn-wrap">
                      <motion.button
                        type="button"
                        className="login3-submit"
                        onClick={onDone}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="nf1-btn-sweep" aria-hidden="true" />
                        Go to Sign In
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="login3-subheading">Choose a strong password of at least 8 characters.</p>

                    <form onSubmit={handleSubmit} noValidate>
                      <div className="login3-field">
                        <span className="login3-label-row">
                          <label htmlFor="snp-password" className="login3-label">New Password</label>
                          <span className="login3-label-required" aria-hidden="true">*</span>
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
                            className="login3-toggle-visibility nf1-pw-toggle"
                            onClick={() => setShowPassword((v) => !v)}
                          >
                            <Eye
                              size={16}
                              aria-hidden="true"
                              style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: `translate(-50%,-50%) scale(${showPassword ? 0.55 : 1})`,
                                opacity: showPassword ? 0 : 1,
                                transition: 'opacity 0.18s, transform 0.18s',
                              }}
                            />
                            <EyeOff
                              size={16}
                              aria-hidden="true"
                              style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: `translate(-50%,-50%) scale(${showPassword ? 1 : 0.55})`,
                                opacity: showPassword ? 1 : 0,
                                transition: 'opacity 0.18s, transform 0.18s',
                              }}
                            />
                            <Eye size={16} style={{ visibility: 'hidden' }} aria-hidden="true" />
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
                          <label htmlFor="snp-confirm" className="login3-label">Confirm Password</label>
                          <span className="login3-label-required" aria-hidden="true">*</span>
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
                            className="login3-toggle-visibility nf1-pw-toggle"
                            onClick={() => setShowConfirm((v) => !v)}
                          >
                            <Eye
                              size={16}
                              aria-hidden="true"
                              style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: `translate(-50%,-50%) scale(${showConfirm ? 0.55 : 1})`,
                                opacity: showConfirm ? 0 : 1,
                                transition: 'opacity 0.18s, transform 0.18s',
                              }}
                            />
                            <EyeOff
                              size={16}
                              aria-hidden="true"
                              style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: `translate(-50%,-50%) scale(${showConfirm ? 1 : 0.55})`,
                                opacity: showConfirm ? 1 : 0,
                                transition: 'opacity 0.18s, transform 0.18s',
                              }}
                            />
                            <Eye size={16} style={{ visibility: 'hidden' }} aria-hidden="true" />
                          </button>
                        </div>
                        {mismatch && (
                          <p className="login3-error" style={{ marginTop: 4, marginBottom: 0 }}>
                            Passwords do not match.
                          </p>
                        )}
                      </div>

                      {error && <div className="login3-error">{error}</div>}

                      <div className="nf1-btn-wrap">
                        <motion.button
                          type="submit"
                          className="login3-submit"
                          disabled={!canSubmit}
                          whileHover={canSubmit ? { scale: 1.02 } : undefined}
                          whileTap={canSubmit ? { scale: 0.98 } : undefined}
                        >
                          <span className="nf1-btn-sweep" aria-hidden="true" />
                          {loading ? <ButtonDots label="Saving" /> : 'Set Password'}
                        </motion.button>
                      </div>
                    </form>
                  </>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetNewPassword
