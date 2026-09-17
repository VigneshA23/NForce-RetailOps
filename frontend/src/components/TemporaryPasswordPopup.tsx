import { useEffect } from 'react';
import { Copy, Mail, MailX } from 'lucide-react';
import { nfToast } from '../utils/toast';
import Modal from './Modal';
import './TemporaryPasswordPopup.css';

const AUTO_CLOSE_MS = 20_000;

interface TemporaryPasswordPopupProps {
  isOpen: boolean;
  name?: string;
  password: string | null;
  emailSent?: boolean;
  onClose: () => void;
}

// Shown once, right after the Super Admin creates an Owner or Employee.
// When password is non-null (legacy path), shows the password as a manual
// fallback. When null (setup-link path), shows the email delivery status only.
function TemporaryPasswordPopup({ isOpen, name, password, emailSent, onClose }: TemporaryPasswordPopupProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function handleCopy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      nfToast.success('Password copied to clipboard.');
    } catch {
      nfToast.error('Could not copy the password. Please copy it manually.');
    }
  }

  const emailStatusKnown = emailSent !== undefined;
  const setupLinkMode = password === null || password === '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Account Created"
      subtitle={name ? `For ${name}` : undefined}
      centered
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      {!setupLinkMode && (
        <div className="temp-password-popup__value-row">
          <code className="temp-password-popup__value">{password}</code>
          <button type="button" className="btn btn--secondary temp-password-popup__copy" onClick={handleCopy}>
            <Copy size={16} />
            Copy
          </button>
        </div>
      )}

      {emailStatusKnown ? (
        emailSent ? (
          <div className="temp-password-popup__email-status temp-password-popup__email-status--sent">
            <Mail size={14} />
            {setupLinkMode
              ? 'Setup link sent — they\'ll receive an email to set their password.'
              : 'Welcome email sent — they\'ll receive it shortly.'}
          </div>
        ) : (
          <div className="temp-password-popup__email-status temp-password-popup__email-status--failed">
            <MailX size={14} />
            {setupLinkMode
              ? 'Email delivery failed. Use "Reset Password" on their account to resend the setup link.'
              : 'Email delivery failed. Copy and share this password with them directly.'}
          </div>
        )
      ) : (
        <p className="temp-password-popup__hint">
          Share this with them now. This dialog will close on its own shortly.
        </p>
      )}
    </Modal>
  );
}

export default TemporaryPasswordPopup;
