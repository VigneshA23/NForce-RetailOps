import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Lock } from 'lucide-react'

interface AuthPasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete?: string
  // Inline hint under the field (e.g. "Passwords do not match.").
  error?: string | null
  // Confirm fields: refuse paste/drop so the password has to be typed again.
  blockPaste?: boolean
}

// The login page's password field -- lock icon, cross-fading eye toggle and the
// focus highlight -- for the Ked's password pages.
function AuthPasswordField({ id, label, value, onChange, placeholder, autoComplete = 'new-password', error, blockPaste = false }: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <div className="login3-field">
      <span className="login3-label-row">
        <label htmlFor={id} className="login3-label">{label}</label>
        <span className="login3-label-required" aria-hidden="true">*</span>
      </span>
      <div className="login3-input-wrap" style={{ overflow: 'hidden' }}>
        <Lock size={16} className="login3-input-icon" aria-hidden="true" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="login3-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={blockPaste ? (e) => e.preventDefault() : undefined}
          onDrop={blockPaste ? (e) => e.preventDefault() : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="login3-toggle-visibility nf1-pw-toggle"
          onClick={() => setVisible((v) => !v)}
        >
          <Eye
            size={16}
            aria-hidden="true"
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: `translate(-50%,-50%) scale(${visible ? 0.55 : 1})`,
              opacity: visible ? 0 : 1,
              transition: 'opacity 0.18s, transform 0.18s',
            }}
          />
          <EyeOff
            size={16}
            aria-hidden="true"
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: `translate(-50%,-50%) scale(${visible ? 1 : 0.55})`,
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.18s, transform 0.18s',
            }}
          />
          <Eye size={16} style={{ visibility: 'hidden' }} aria-hidden="true" />
        </button>
        <AnimatePresence>
          {focused && (
            <motion.div
              className="nf1-input-highlight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
          )}
        </AnimatePresence>
      </div>
      {error && (
        <p className="login3-error" style={{ marginTop: 4, marginBottom: 0 }}>{error}</p>
      )}
    </div>
  )
}

export default AuthPasswordField
