import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react'
import { Check, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { motion } from 'motion/react'
import { login } from '../api/auth'
import type { AuthUser } from '../types/auth'
import { useScrambleText } from '../hooks/useScrambleText'
import LoginHeroPanel from '../components/LoginHeroPanel'
import './LoginCrimson.css'

interface LoginProps {
  onLoginSuccess: (user: AuthUser, remember: boolean, mustResetPassword: boolean) => void
  onForgotPassword: () => void
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

function Login({ onLoginSuccess, onForgotPassword, notice }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success'>('idle')
  const [confettiKey, setConfettiKey] = useState(0)

  const cardRef = useRef<HTMLDivElement>(null)
  const cardRafRef = useRef(0)

  // Stores login result so it can be passed to onLoginSuccess after success animation
  const pendingLoginRef = useRef<{
    result: AuthUser
    remember: boolean
    mustReset: boolean
  } | null>(null)

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

  const isSuccess = submitStatus === 'success'

  return (
    <div className="login3-shell">
      <div className="login3-bg-overlay" aria-hidden="true" />

      <div className="login3-grid">
        {/* Teal left panel — desktop only (CSS hides on mobile) */}
        <div className="login3-hero">
          <LoginHeroPanel />
        </div>

        {/* Right form column */}
        <div className="login3-panel">
          {/* Card wrapper — handles 3D tilt on desktop */}
          <div
            className="nf1-card-wrap"
            onMouseMove={onCardMouseMove}
            onMouseLeave={onCardMouseLeave}
          >
            {/* Spinning conic border (desktop only via CSS) */}
            <div className="nf1-spin-border" aria-hidden="true" />

            {/* The card itself — transform target for tilt */}
            <motion.div
              ref={cardRef}
              className="login3-panel-inner"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 0.84, 0.3, 1] }}
            >
              {/* Card top decorations */}
              <div className="nf1-card-highlight" aria-hidden="true" />
              <div className="nf1-card-sweep" aria-hidden="true" />

              {/* Mobile-only brand lockup */}
              <div className="login3-mobile-brand">
                <img src="/nforce-logo.png" alt="NForce RetailOps logo" className="login3-mobile-logo" />
                <p className="login3-mobile-wordmark">NForce RetailOps</p>
                <span className="login3-mobile-tagline">
                  Your stores.{' '}
                  <span className="login3-mobile-tagline-accent">One checklist.</span>
                </span>
              </div>

              {/* Desktop-only card brand header */}
              <div className="nf1-card-header">
                <img src="/nforce-logo.png" alt="" className="nf1-card-logo" aria-hidden="true" />
                <span className="nf1-card-wordmark">NForce RetailOps</span>
              </div>

              <h1 className="login3-heading">{heading}</h1>
              <span className="login3-heading-underline" aria-hidden="true" />
              <p className="login3-subheading">Sign in to access RetailOps</p>

              {notice && (
                <div className="login3-error" role="status">{notice}</div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <motion.div
                  className="login3-field"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.42 }}
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
                  transition={{ delay: 0.26, duration: 0.42 }}
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
                      {/* Cross-fade: both icons always mounted, opacity/scale transitions */}
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
                      {/* Invisible placeholder maintains button hit area */}
                      <Eye size={16} style={{ visibility: 'hidden' }} aria-hidden="true" />
                    </button>
                  </div>
                </motion.div>

                <motion.div
                  className="login3-meta-row"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.34, duration: 0.42 }}
                >
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
                </motion.div>

                {error && <div className="login3-error">{error}</div>}

                <motion.div
                  className="nf1-btn-wrap"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42, duration: 0.42 }}
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

                  {/* Confetti burst — keyed so new dots mount on each success */}
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
