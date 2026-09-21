import { useState } from 'react';
import Modal from './Modal';
import ButtonDots from './ButtonDots';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // May return a Promise -- if it does, the Confirm button shows animated
  // dots and both buttons (plus the modal's close paths) are disabled until
  // it resolves/rejects. A plain `() => void` handler (e.g. ProfileMenu's
  // logout, which closes the dialog synchronously itself) behaves exactly as
  // before, since there's no promise to await.
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  centered?: boolean;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
  centered = false,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm() {
    const result = onConfirm();
    if (result instanceof Promise) {
      setIsConfirming(true);
      try {
        await result;
      } finally {
        setIsConfirming(false);
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isConfirming ? () => {} : onCancel}
      title={title}
      centered={centered}
      footer={
        <>
          <button type="button" className="btn btn--secondary" disabled={isConfirming} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}${isConfirming ? ' btn--loading' : ''}`}
            disabled={isConfirming}
            onClick={handleConfirm}
          >
            {isConfirming ? <ButtonDots label={confirmLabel} /> : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;
