import { useEffect } from 'react';
import { Copy } from 'lucide-react';
import { nfToast } from '../utils/toast';
import Modal from './Modal';
import './TemporaryPasswordPopup.css';

const AUTO_CLOSE_MS = 15_000;

interface TemporaryPasswordPopupProps {
  isOpen: boolean;
  name?: string;
  password: string | null;
  onClose: () => void;
}

// Shown once, right after the Super Admin creates an Owner or Employee --
// the only moment this password is ever visible outside the account's own
// inbox. Auto-closes so it doesn't linger on screen indefinitely.
function TemporaryPasswordPopup({ isOpen, name, password, onClose }: TemporaryPasswordPopupProps) {
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

  return (
    <Modal
      isOpen={isOpen && password != null}
      onClose={onClose}
      title="Temporary Password"
      subtitle={name ? `For ${name}` : undefined}
      centered
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <p className="temp-password-popup__hint">
        Share this with them now -- it also went out by email, but this dialog will close on its own shortly.
      </p>
      <div className="temp-password-popup__value-row">
        <code className="temp-password-popup__value">{password}</code>
        <button type="button" className="btn btn--secondary temp-password-popup__copy" onClick={handleCopy}>
          <Copy size={16} />
          Copy
        </button>
      </div>
    </Modal>
  );
}

export default TemporaryPasswordPopup;
