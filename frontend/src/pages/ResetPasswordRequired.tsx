import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { completePasswordReset } from '../api/auth'
import KedsAuthCard from '../components/KedsAuthCard'
import AuthPasswordField from '../components/AuthPasswordField'
import ButtonDots from '../components/ButtonDots'

interface ResetPasswordRequiredProps {
  onSuccess: () => void
  onLogout: () => void
  loggingOut?: boolean
}

// Shown after signing in with a temporary password. Same Ked's card as the
// login page; success goes straight into the app (the user is signed in).
function ResetPasswordRequired({ onSuccess, onLogout, loggingOut }: ResetPasswordRequiredProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    <KedsAuthCard>
      <h1 className="login3-heading">Set a New Password</h1>
      <span className="login3-heading-underline" aria-hidden="true" />

      <form onSubmit={handleSubmit} noValidate>
        <AuthPasswordField
          id="new-password"
          label="New Password"
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={setNewPassword}
        />
        <AuthPasswordField
          id="confirm-password"
          label="Confirm Password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        {error && <div className="login3-error">{error}</div>}

        <div className="nf1-btn-wrap">
          <motion.button
            type="submit"
            className="login3-submit"
            disabled={loading}
            whileHover={!loading ? { scale: 1.02 } : undefined}
            whileTap={!loading ? { scale: 0.98 } : undefined}
          >
            <span className="nf1-btn-sweep" aria-hidden="true" />
            {loading ? <ButtonDots label="Saving" /> : 'Set Password & Continue'}
          </motion.button>
        </div>
      </form>

      <p className="login3-access-note">
        <button type="button" className="login3-forgot-link" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? 'Signing out…' : 'Sign out instead'}
        </button>
      </p>
    </KedsAuthCard>
  )
}

export default ResetPasswordRequired
