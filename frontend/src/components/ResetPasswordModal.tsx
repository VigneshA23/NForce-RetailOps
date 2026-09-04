import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { changePassword } from '../api/auth';
import Modal from './Modal';
import FormField from './FormField';
import './ResetPasswordModal.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Employee pages only -- see Modal's `centered` prop.
  centered?: boolean;
  // Defaults to "Change Password" for self-service use; pass "Reset Password"
  // when used in an admin context (e.g. admin resetting an employee's password).
  title?: string;
}

function emptyState() {
  return { currentPassword: '', newPassword: '', confirmPassword: '' };
}

function passwordStrength(pwd: string): { label: string; level: 0 | 1 | 2 | 3 } {
  if (pwd.length < 8) return { label: 'Too short', level: 0 };
  let score = 0;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score === 0) return { label: 'Weak', level: 1 };
  if (score === 1) return { label: 'Fair', level: 2 };
  return { label: 'Strong', level: 3 };
}

function ResetPasswordModal({ isOpen, onClose, centered = false, title = 'Change Password' }: ResetPasswordModalProps) {
  const [values, setValues] = useState(emptyState());
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues(emptyState());
      setShow({ current: false, new: false, confirm: false });
      setCurrentError(null);
      setSubmitError(null);
      setSucceeded(false);
    }
  }, [isOpen]);

  const strength = values.newPassword ? passwordStrength(values.newPassword) : null;
  const mismatch = values.confirmPassword.length > 0 && values.newPassword !== values.confirmPassword;
  const newTooShort = values.newPassword.length > 0 && values.newPassword.length < 8;

  function validate(): boolean {
    if (!values.currentPassword) {
      setSubmitError('Current password is required.');
      return false;
    }
    if (values.newPassword.length < 8) {
      setSubmitError('New password must be at least 8 characters.');
      return false;
    }
    if (values.newPassword !== values.confirmPassword) {
      setSubmitError('Passwords do not match.');
      return false;
    }
    return true;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setCurrentError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      setSucceeded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to change password.';
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
        setCurrentError('Current password is incorrect.');
      } else {
        setSubmitError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggle(field: keyof typeof show) {
    setShow((s) => ({ ...s, [field]: !s[field] }));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      centered={centered}
      title={title}
      footer={
        succeeded ? (
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="reset-password-form"
              className="btn btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : 'Change Password'}
            </button>
          </>
        )
      }
    >
      {succeeded ? (
        <p className="rp-success">Password changed successfully.</p>
      ) : (
        <form id="reset-password-form" onSubmit={handleSubmit} noValidate>
          <FormField label="Current Password" htmlFor="rp-current" required error={currentError ?? undefined}>
            <div className="rp-input-wrap">
              <input
                id="rp-current"
                type={show.current ? 'text' : 'password'}
                autoComplete="current-password"
                className="input"
                value={values.currentPassword}
                onChange={(e) => {
                  setValues((v) => ({ ...v, currentPassword: e.target.value }));
                  setCurrentError(null);
                }}
              />
              <button
                type="button"
                className="rp-eye"
                aria-label={show.current ? 'Hide password' : 'Show password'}
                onClick={() => toggle('current')}
              >
                {show.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          <FormField
            label="New Password"
            htmlFor="rp-new"
            required
            error={newTooShort ? 'At least 8 characters required.' : undefined}
          >
            <div className="rp-input-wrap">
              <input
                id="rp-new"
                type={show.new ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="input"
                value={values.newPassword}
                onChange={(e) => setValues((v) => ({ ...v, newPassword: e.target.value }))}
              />
              <button
                type="button"
                className="rp-eye"
                aria-label={show.new ? 'Hide password' : 'Show password'}
                onClick={() => toggle('new')}
              >
                {show.new ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {strength && (
              <div className="rp-strength" aria-live="polite">
                <div className="rp-strength__bars">
                  {([1, 2, 3] as const).map((lvl) => (
                    <div
                      key={lvl}
                      className={`rp-strength__bar rp-strength__bar--${strength.level >= lvl ? ['', 'weak', 'fair', 'strong'][strength.level] : 'empty'}`}
                    />
                  ))}
                </div>
                <span className="rp-strength__label">{strength.label}</span>
              </div>
            )}
          </FormField>

          <FormField
            label="Confirm New Password"
            htmlFor="rp-confirm"
            required
            error={mismatch ? 'Passwords do not match.' : undefined}
          >
            <div className="rp-input-wrap">
              <input
                id="rp-confirm"
                type={show.confirm ? 'text' : 'password'}
                autoComplete="new-password"
                className="input"
                value={values.confirmPassword}
                onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
              />
              <button
                type="button"
                className="rp-eye"
                aria-label={show.confirm ? 'Hide password' : 'Show password'}
                onClick={() => toggle('confirm')}
              >
                {show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          {submitError && <p className="form-field__error">{submitError}</p>}
        </form>
      )}
    </Modal>
  );
}

export default ResetPasswordModal;
