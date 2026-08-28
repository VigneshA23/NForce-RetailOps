import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

function Modal({ isOpen, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerElementRef.current = document.activeElement;

    const firstField = modalRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.modal__close)',
    );
    firstField?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerElementRef.current instanceof HTMLElement) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${size === 'lg' ? ' modal--lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={modalRef}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
