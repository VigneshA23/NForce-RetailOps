// The one email-format rule for the app (RTS-582): Login, Forgot Password,
// and every form that saves an email (Owner, Employee, Profile). The backend
// applies the same rule and message to saved emails (validation/EmailFormat.java)
// -- keep the two in step.

// local@domain.tld, no spaces, at least one dot in the domain and an ending of
// two or more characters.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address';

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
