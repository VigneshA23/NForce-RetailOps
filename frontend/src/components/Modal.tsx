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
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<Element | null>(null);

  // Callers (e.g. an inline onClose={() => ...}) rarely memoize this, so it's
  // a fresh function on every render. Reading it via a ref keeps the effects
  // below keyed only on isOpen, instead of re-running on every parent
  // re-render while the modal stays open.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // `position: fixed; inset: 0` anchors the overlay to the LAYOUT viewport.
  // Mobile pinch-zoom scales/pans the VISUAL viewport without changing the
  // layout viewport at all, so on iOS/Android the overlay can end up sized or
  // positioned outside what's actually on screen once the user zooms and
  // pans -- the modal (and its Close button) can become unreachable even
  // though nothing about the CSS viewport changed. `window.visualViewport`
  // is the only thing that reports that scale/pan, so while the modal is
  // open we keep the overlay's box explicitly pinned to it. On browsers
  // without visualViewport (or on desktop, where it always matches the
  // window) this is a no-op and the CSS `inset: 0` fallback below applies.
  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    function syncToVisualViewport() {
      const overlay = overlayRef.current;
      if (!overlay || !viewport) return;
      overlay.style.width = `${viewport.width}px`;
      overlay.style.height = `${viewport.height}px`;
      overlay.style.left = `${viewport.offsetLeft}px`;
      overlay.style.top = `${viewport.offsetTop}px`;
    }

    syncToVisualViewport();
    viewport.addEventListener('resize', syncToVisualViewport);
    viewport.addEventListener('scroll', syncToVisualViewport);
    return () => {
      viewport.removeEventListener('resize', syncToVisualViewport);
      viewport.removeEventListener('scroll', syncToVisualViewport);
    };
  }, [isOpen]);

  // Lock background scrolling while any modal is open. `overflow: hidden` on
  // body alone is NOT enough on iOS Safari -- it still pans/bounces the page
  // under touch regardless of that CSS property. Pinning body with
  // `position: fixed` at its current scroll offset is the standard fix that
  // actually holds on iOS as well as desktop; the offset is restored (and the
  // page snapped back to its exact prior scroll position) on close/unmount.
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const { body } = document;
    const previousStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previousStyle.position;
      body.style.top = previousStyle.top;
      body.style.left = previousStyle.left;
      body.style.right = previousStyle.right;
      body.style.width = previousStyle.width;
      body.style.overflow = previousStyle.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    triggerElementRef.current = document.activeElement;

    const firstField = modalRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.modal__close)',
    );
    firstField?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerElementRef.current instanceof HTMLElement) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
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
