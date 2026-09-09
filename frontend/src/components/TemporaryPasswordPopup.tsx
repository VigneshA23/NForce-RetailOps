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

// Shown once, right after the Super Admin creates an Owner or Employee --
// the only moment this password is ever visible outside the account's own
// inbox. Auto-closes so it doesn't linger on screen indefinitely.
function TemporaryPasswordPopup({ isOpen, name, password, emailSent, onClose }: TemporaryPasswordPopupProps) {
  useEffect(() => {
    if (!isOpen || !password) return;
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, password]);

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

  return (
    <Modal
      isOpen={isOpen && password != null}
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
      <div className="temp-password-popup__value-row">
        <code className="temp-password-popup__value">{password}</code>
        <button type="button" className="btn btn--secondary temp-password-popup__copy" onClick={handleCopy}>
          <Copy size={16} />
          Copy
        </button>
      </div>

      {emailStatusKnown ? (
        emailSent ? (
          <div className="temp-password-popup__email-status temp-password-popup__email-status--sent">
            <Mail size={14} />
            Welcome email sent — they'll receive it shortly.
          </div>
        ) : (
          <div className="temp-password-popup__email-status temp-password-popup__email-status--failed">
            <MailX size={14} />
            Email delivery failed. Copy and share this password with them directly.
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
