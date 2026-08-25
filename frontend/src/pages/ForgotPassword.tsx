import { useState, type FormEvent } from 'react'
import { requestPasswordReset } from '../api/auth'
import AuthBrandPanel from '../components/AuthBrandPanel'
import AuthMobileBrand from '../components/AuthMobileBrand'
import './Login.css'

interface ForgotPasswordProps {
  onBackToSignIn: () => void
}

function ForgotPassword({ onBackToSignIn }: ForgotPasswordProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

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
    <div className="login-shell">
      <AuthBrandPanel
        heading="Forgot your password?"
        description="Enter your email and we'll send reset instructions if an account exists."
      />

      <div className="login-right">
        <AuthMobileBrand />
        <div className="login-form-wrap">
          <h1 className="login-heading">Reset password</h1>
          <p className="login-reset-description">
            Enter your organizational email. If it's registered, you'll receive a temporary
            password.
          </p>

          {submitted ? (
            <>
              <p className="login-success">
                If an account exists for {email}, reset instructions are on their way.
              </p>
              <button type="button" className="login-back-link" onClick={onBackToSignIn}>
                ← Back to sign in
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@nforceone.com"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && <div className="login-error">{error}</div>}

              <div className="login-field">
                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? 'Sending…' : 'Reset'}
                </button>
              </div>

              <button type="button" className="login-back-link" onClick={onBackToSignIn}>
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
