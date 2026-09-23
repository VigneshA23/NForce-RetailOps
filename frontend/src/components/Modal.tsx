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
  // Keeps the dialog centered on mobile instead of the default bottom-sheet
  // layout. Off by default; the logout confirmation dialog opts in across
  // all three shells (Employee, Owner/Admin, Super Admin).
  centered?: boolean;
  // Extra class on the dialog card, for per-form styling.
  className?: string;
  // Optional icon before the title, and element after it (e.g. a status pill).
  titleIcon?: ReactNode;
  titleExtra?: ReactNode;
}

function Modal({ isOpen, onClose, title, subtitle, children, footer, size = 'md', centered = false, className, titleIcon, titleExtra }: ModalProps) {
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
  //
  // The same viewport also shrinks when the soft keyboard opens (most
  // reliably reported on Android Chrome; iOS Safari mainly reports it via
  // `resize`, not layout-viewport resize). We publish that live height as
  // `--modal-vvh`, which Modal.css prefers over the dvh/svh max-height, so
  // the modal card itself always fits the space actually left on screen
  // instead of being pushed/clipped off the top by the keyboard.
  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    function syncToVisualViewport() {
      const overlay = overlayRef.current;
      const modalEl = modalRef.current;
      if (!overlay || !viewport) return;
      overlay.style.width = `${viewport.width}px`;
      overlay.style.height = `${viewport.height}px`;
      overlay.style.left = `${viewport.offsetLeft}px`;
      overlay.style.top = `${viewport.offsetTop}px`;
      modalEl?.style.setProperty('--modal-vvh', `${viewport.height}px`);
    }

    syncToVisualViewport();
    viewport.addEventListener('resize', syncToVisualViewport);
    viewport.addEventListener('scroll', syncToVisualViewport);
    return () => {
      viewport.removeEventListener('resize', syncToVisualViewport);
      viewport.removeEventListener('scroll', syncToVisualViewport);
      modalRef.current?.style.removeProperty('--modal-vvh');
    };
  }, [isOpen]);

  // Lock background scrolling while any modal is open. `overflow: hidden` on
  // body alone is NOT enough on iOS Safari -- it still pans/bounces the page
  // under touch regardless of that CSS property. Pinning body with
  // `position: fixed` at its current scroll offset is the standard fix that
  // actually holds on iOS as well as desktop; the offset is restored (and the
  // page snapped back to its exact prior scroll position) on close/unmount.
  // `html` gets `overflow: hidden` too -- body's fixed positioning handles
  // touch panning/bounce, but html is what Android Chrome's own
  // focused-input-into-view scroll acts on when the keyboard opens, so
  // leaving it scrollable is what lets that scroll escape past the modal.
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const html = document.documentElement;
    const { body } = document;
    const previousHtmlOverflow = html.style.overflow;
    const previousStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    html.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.position = previousStyle.position;
      body.style.top = previousStyle.top;
      body.style.left = previousStyle.left;
      body.style.right = previousStyle.right;
      body.style.width = previousStyle.width;
      body.style.overflow = previousStyle.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // `--modal-vvh` shrinks the modal card to fit above the keyboard, but on a
  // tall form the now-focused field can still land underneath it (nothing
  // repositions scroll within `.modal__body` itself). Scroll the focused
  // field into view as a fallback once the keyboard has had time to animate
  // in, so Save stays reachable even when shrinking the card alone isn't
  // enough.
  useEffect(() => {
    if (!isOpen) return;

    function handleFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!modalRef.current?.contains(target)) return;
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      setTimeout(() => target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 300);
    }

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
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
      className={`modal-overlay${centered ? ' modal-overlay--centered' : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${size === 'lg' ? ' modal--lg' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={modalRef}
      >
        <div className="modal__header">
          <div>
            <div className="modal__title-row">
              {titleIcon && <span className="modal__title-icon" aria-hidden="true">{titleIcon}</span>}
              <h2 className="modal__title" id={titleId}>
                {title}
              </h2>
              {titleExtra}
            </div>
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
