import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { login, requestPasswordReset } from '../api/auth'
import type { AuthUser } from '../types/auth'
import { useScrambleText } from '../hooks/useScrambleText'
import LoginHeroPanel from '../components/LoginHeroPanel'
import './LoginCrimson.css'

interface LoginProps {
  onLoginSuccess: (user: AuthUser, remember: boolean, mustResetPassword: boolean) => void
  notice?: string | null
}

// Pre-computed confetti positions so they're stable across renders
const CONFETTI_DOTS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2
  const dist = 55 + (i % 3) * 18
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist),
    color: (['#DC1C2E', '#E8394A', '#F2C13C', '#ffffff'] as const)[i % 4],
    delay: i * 0.028,
    size: 5 + (i % 3),
  }
})

function Login({ onLoginSuccess, notice }: LoginProps) {
  const [loginView, setLoginView] = useState<'sign-in' | 'forgot'>('sign-in')

  // Sign-in state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success'>('idle')
  const [confettiKey, setConfettiKey] = useState(0)

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSubmitted, setForgotSubmitted] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)
  const cardRafRef = useRef(0)
  const pendingLoginRef = useRef<{ result: AuthUser; remember: boolean; mustReset: boolean } | null>(null)

  const heading = useScrambleText('Welcome Back')

  // Card 3D tilt — RAF, writes transform directly, never setState on mousemove
  const onCardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    cancelAnimationFrame(cardRafRef.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    cardRafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return
      cardRef.current.style.transition = 'none'
      cardRef.current.style.transform = [
        'perspective(920px)',
        `rotateX(${(-py * 5).toFixed(2)}deg)`,
        `rotateY(${(px * 6).toFixed(2)}deg)`,
        'translateY(-6px)',
      ].join(' ')
      cardRef.current.style.boxShadow = [
        `${(-px * 20).toFixed(0)}px ${(-py * 14).toFixed(0)}px 60px rgba(0,0,0,0.22)`,
        '0 32px 70px rgba(0,0,0,0.14)',
        '0 0 0 1px rgba(255,255,255,0.08)',
      ].join(', ')
    })
  }, [])

  const onCardMouseLeave = useCallback(() => {
    cancelAnimationFrame(cardRafRef.current)
    if (!cardRef.current) return
    cardRef.current.style.transition =
      'transform 0.55s cubic-bezier(.16,.84,.3,1), box-shadow 0.45s cubic-bezier(.16,.84,.3,1)'
    cardRef.current.style.transform = ''
    cardRef.current.style.boxShadow = ''
  }, [])

  useEffect(() => () => cancelAnimationFrame(cardRafRef.current), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitStatus === 'success') return
    setError(null)
    setLoading(true)
    try {
      const result = await login(email, password)
      pendingLoginRef.current = { result, remember: rememberMe, mustReset: result.mustResetPassword }
      setSubmitStatus('success')
      setConfettiKey(k => k + 1)
      setTimeout(() => {
        const pending = pendingLoginRef.current
        if (pending) onLoginSuccess(pending.result, pending.remember, pending.mustReset)
      }, 500)
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotSubmit(event: FormEvent) {
    event.preventDefault()
    setForgotError(null)
    setForgotLoading(true)
    try {
      await requestPasswordReset(forgotEmail)
      setForgotSubmitted(true)
    } catch {
      setForgotError('Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  function goToForgot() {
    setLoginView('forgot')
    setForgotEmail('')
    setForgotError(null)
    setForgotSubmitted(false)
  }

  function backToSignIn() {
    setLoginView('sign-in')
  }

  const isSuccess = submitStatus === 'success'

  return (
    <div className="login3-shell">
      <div className="login3-bg-overlay" aria-hidden="true" />

      <div className="login3-grid">
        <div className="login3-hero">
          <LoginHeroPanel />
        </div>

        <div className="login3-panel">
          <div
            className="nf1-card-wrap"
            onMouseMove={onCardMouseMove}
            onMouseLeave={onCardMouseLeave}
          >
            <div className="nf1-spin-border" aria-hidden="true" />

            <motion.div
              ref={cardRef}
              className="login3-panel-inner"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 0.84, 0.3, 1] }}
            >
              <div className="nf1-card-highlight" aria-hidden="true" />
              <div className="nf1-card-sweep" aria-hidden="true" />

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

              <AnimatePresence mode="wait">
                {loginView === 'sign-in' ? (
                  <motion.div
                    key="sign-in"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                  >
                    <h1 className="login3-heading">{heading}</h1>
                    <span className="login3-heading-underline" aria-hidden="true" />
                    <p className="login3-subheading">Sign in to access RetailOps</p>

                    {notice && <div className="login3-error" role="status">{notice}</div>}

                    <form onSubmit={handleSubmit} noValidate>
                      <motion.div
                        className="login3-field"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08, duration: 0.36 }}
                      >
                        <span className="login3-label-row">
                          <label htmlFor="email" className="login3-label">Email</label>
                          <span className="login3-label-required" aria-hidden="true">*</span>
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
                      </motion.div>

                      <motion.div
                        className="login3-field"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.16, duration: 0.36 }}
                      >
                        <span className="login3-label-row">
                          <label htmlFor="password" className="login3-label">Password</label>
                          <span className="login3-label-required" aria-hidden="true">*</span>
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
                            className="login3-toggle-visibility nf1-pw-toggle"
                            onClick={() => setShowPassword(v => !v)}
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
                      </motion.div>

                      <motion.div
                        className="login3-meta-row"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.24, duration: 0.36 }}
                      >
                        <label className="login3-remember">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                          />
                          Remember me
                        </label>
                        <button type="button" className="login3-forgot-link" onClick={goToForgot}>
                          Forgot Password?
                        </button>
                      </motion.div>

                      {error && <div className="login3-error">{error}</div>}

                      <motion.div
                        className="nf1-btn-wrap"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.32, duration: 0.36 }}
                      >
                        <motion.button
                          type="submit"
                          className={`login3-submit${isSuccess ? ' login3-submit--success' : ''}`}
                          disabled={loading || isSuccess}
                          whileHover={!isSuccess && !loading ? { scale: 1.01 } : undefined}
                          whileTap={!isSuccess && !loading ? { scale: 0.98 } : undefined}
                        >
                          <span className="nf1-btn-sweep" aria-hidden="true" />
                          {isSuccess ? (
                            <>
                              <Check size={15} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                              Signed in!
                            </>
                          ) : loading ? (
                            'Signing in…'
                          ) : (
                            'Sign In'
                          )}
                        </motion.button>

                        {confettiKey > 0 &&
                          CONFETTI_DOTS.map((dot, i) => (
                            <span
                              key={`${confettiKey}-${i}`}
                              className="nf1-confetti-dot"
                              style={{
                                '--dx': `${dot.dx}px`,
                                '--dy': `${dot.dy}px`,
                                width: dot.size,
                                height: dot.size,
                                background: dot.color,
                                animationDelay: `${dot.delay}s`,
                              } as React.CSSProperties}
                              aria-hidden="true"
                            />
                          ))}
                      </motion.div>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                  >
                    {!forgotSubmitted && (
                      <>
                        <h1 className="login3-heading">Reset Password</h1>
                        <span className="login3-heading-underline" aria-hidden="true" />
                        <p className="login3-subheading">
                          Enter your organisational email and we'll send reset instructions.
                        </p>
                      </>
                    )}

                    {forgotSubmitted ? (
                      <div className="login3-sent-block" role="status">
                        <div className="login3-sent-icon" aria-hidden="true">
                          <CheckCircle2 size={32} strokeWidth={1.6} />
                        </div>
                        <p className="login3-sent-title">Check your inbox</p>
                        <p className="login3-sent-body">Reset instructions sent to:</p>
                        <p className="login3-sent-email">{forgotEmail}</p>
                        <p className="login3-sent-hint">Didn't see it? Check your spam folder.</p>
                        <motion.button
                          type="button"
                          className="login3-submit"
                          onClick={backToSignIn}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="nf1-btn-sweep" aria-hidden="true" />
                          <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden="true" />
                          Back to sign in
                        </motion.button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgotSubmit} noValidate>
                        <div className="login3-field">
                          <span className="login3-label-row">
                            <label htmlFor="forgot-email" className="login3-label">Email</label>
                            <span className="login3-label-required" aria-hidden="true">*</span>
                          </span>
                          <div className="login3-input-wrap">
                            <Mail size={16} className="login3-input-icon" aria-hidden="true" />
                            <input
                              id="forgot-email"
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              placeholder="you@nforceone.com"
                              className="login3-input"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                            />
                          </div>
                        </div>

                        {forgotError && <div className="login3-error">{forgotError}</div>}

                        <div className="nf1-btn-wrap">
                          <motion.button
                            type="submit"
                            className="login3-submit"
                            disabled={forgotLoading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <span className="nf1-btn-sweep" aria-hidden="true" />
                            {forgotLoading ? 'Sending…' : 'Send Reset Instructions'}
                          </motion.button>
                        </div>

                        <p className="login3-access-note">
                          <button type="button" className="login3-forgot-link" onClick={backToSignIn}>
                            <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
                          </button>
                        </p>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
