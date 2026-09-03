import { useEffect, useState, type FormEvent } from 'react';
import { changePassword } from '../api/auth';
import Modal from './Modal';
import FormField from './FormField';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Employee pages only -- see Modal's `centered` prop.
  centered?: boolean;
}

interface FormErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

function emptyState() {
  return { currentPassword: '', newPassword: '', confirmPassword: '' };
}

function ResetPasswordModal({ isOpen, onClose, centered = false }: ResetPasswordModalProps) {
  const [values, setValues] = useState(emptyState());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues(emptyState());
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  function validate(): FormErrors {
    const validationErrors: FormErrors = {};
    if (!values.currentPassword) validationErrors.currentPassword = 'Old password is required';
    if (!values.newPassword) {
      validationErrors.newPassword = 'New password is required';
    } else if (values.newPassword.length < 8) {
      validationErrors.newPassword = 'Password must be at least 8 characters';
    }
    if (!values.confirmPassword) {
      validationErrors.confirmPassword = 'Please confirm your new password';
    } else if (values.newPassword && values.newPassword !== values.confirmPassword) {
      validationErrors.confirmPassword = 'New password and confirmation do not match';
    }
    return validationErrors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to change password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      centered={centered}
      title="Reset Password"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="reset-password-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Reset Password'}
          </button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Old Password" htmlFor="reset-password-current" required error={errors.currentPassword}>
          <input
            id="reset-password-current"
            type="password"
            autoComplete="current-password"
            className="input"
            value={values.currentPassword}
            onChange={(event) => setValues((current) => ({ ...current, currentPassword: event.target.value }))}
          />
        </FormField>

        <FormField label="New Password" htmlFor="reset-password-new" required error={errors.newPassword}>
          <input
            id="reset-password-new"
            type="password"
            autoComplete="new-password"
            className="input"
            placeholder="At least 8 characters"
            value={values.newPassword}
            onChange={(event) => setValues((current) => ({ ...current, newPassword: event.target.value }))}
          />
        </FormField>

        <FormField label="Confirm New Password" htmlFor="reset-password-confirm" required error={errors.confirmPassword}>
          <input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            className="input"
            value={values.confirmPassword}
            onChange={(event) => setValues((current) => ({ ...current, confirmPassword: event.target.value }))}
          />
        </FormField>

        {submitError && <p className="form-field__error">{submitError}</p>}
      </form>
    </Modal>
  );
}

export default ResetPasswordModal;
