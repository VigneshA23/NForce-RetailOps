import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { updateMe, type MeResponse } from '../api/me';
import FormField from './FormField';

interface EditProfileFormProps {
  me: MeResponse;
  onSaved: (updated: MeResponse) => void;
  onCancel: () => void;
  onOpenResetPassword: () => void;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EditProfileForm({ me, onSaved, onCancel, onOpenResetPassword }: EditProfileFormProps) {
  const [fullName, setFullName] = useState(me.fullName);
  const [email, setEmail] = useState(me.email);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FormErrors {
    const validationErrors: FormErrors = {};
    if (!fullName.trim()) validationErrors.fullName = 'Full name is required';
    if (!email.trim()) {
      validationErrors.email = 'Email is required';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      validationErrors.email = 'Enter a valid email address';
    }
    if (!phone.trim()) validationErrors.phone = 'Mobile number is required';
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
      const updated = await updateMe({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim() });
      onSaved(updated);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to save changes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="Full Name" htmlFor="edit-profile-name" required error={errors.fullName}>
        <input
          id="edit-profile-name"
          className="input"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </FormField>

      <FormField label="Email" htmlFor="edit-profile-email" required error={errors.email}>
        <input
          id="edit-profile-email"
          type="email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>

      <FormField label="Mobile" htmlFor="edit-profile-phone" required error={errors.phone}>
        <input
          id="edit-profile-phone"
          type="tel"
          className="input"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </FormField>

      {submitError && <p className="form-field__error">{submitError}</p>}

      <div className="profile-card__actions">
        <button type="button" className="btn btn--secondary" onClick={onOpenResetPassword}>
          Reset Password
        </button>
        <div className="profile-card__actions-end">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default EditProfileForm;
