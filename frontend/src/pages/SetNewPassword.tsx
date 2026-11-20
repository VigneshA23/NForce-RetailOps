import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { confirmPasswordReset } from '../api/auth'
import KedsAuthCard from '../components/KedsAuthCard'
import AuthPasswordField from '../components/AuthPasswordField'
import ButtonDots from '../components/ButtonDots'

interface SetNewPasswordProps {
  token: string
  onDone: () => void
}

// Opened from the account-setup and password-reset email links (?token=).
// Same Ked's card as the login page; on success it swaps to the same
// confirmation block as "Check your inbox" after Forgot Password.
function SetNewPassword({ token, onDone }: SetNewPasswordProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= 8 && confirm.length > 0 && password === confirm && !loading

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
    <KedsAuthCard>
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div className="login3-sent-block" role="status">
              <div className="login3-sent-icon" aria-hidden="true">
                <CheckCircle2 size={32} strokeWidth={1.6} />
              </div>
              <p className="login3-sent-title">Password set</p>
              <p className="login3-sent-body">Your password has been saved.</p>
              <p className="login3-sent-hint">You can now sign in with your new password.</p>
              <motion.button
                type="button"
                className="login3-submit"
                onClick={onDone}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="nf1-btn-sweep" aria-hidden="true" />
                <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden="true" />
                Back to sign in
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <h1 className="login3-heading">Set Your Password</h1>
            <span className="login3-heading-underline" aria-hidden="true" />

            <form onSubmit={handleSubmit} noValidate>
              <AuthPasswordField
                id="snp-password"
                label="New Password"
                placeholder="At least 8 characters"
                value={password}
                onChange={setPassword}
                error={tooShort ? 'At least 8 characters required.' : null}
              />
              <AuthPasswordField
                id="snp-confirm"
                label="Confirm Password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={setConfirm}
                blockPaste
                error={mismatch ? 'Passwords do not match.' : null}
              />

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

              <p className="login3-access-note">
                <button type="button" className="login3-forgot-link" onClick={onDone}>
                  <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
                </button>
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </KedsAuthCard>
  )
}

export default SetNewPassword
