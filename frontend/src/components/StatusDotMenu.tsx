import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './StatusDotMenu.css';

export interface StatusDotOption {
  value: string;
  label: string;
  dot: string;
}

interface StatusDotMenuProps {
  options: StatusDotOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  width?: number;
}

const VIEWPORT_MARGIN = 8;

// A status picker styled after the Orders redesign: a colored dot in both the
// trigger and each option, instead of Select's plain text list. Shares
// Select's portaled/viewport-clamped positioning so it behaves the same in a
// table cell near the edge of the screen.
function StatusDotMenu({ options, value, onChange, ariaLabel, width = 172 }: StatusDotMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.right - width });
    setIsOpen(true);
  }

  function repositionPanel() {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;

    let top = triggerRect.bottom + 4;
    if (top + panelRect.height > viewportHeight - VIEWPORT_MARGIN) {
      top = triggerRect.top - panelRect.height - 4;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    let left = Math.min(triggerRect.right - panelRect.width, viewportWidth - panelRect.width - VIEWPORT_MARGIN);
    left = Math.max(VIEWPORT_MARGIN, left);

    setPosition((current) => (top !== current.top || left !== current.left ? { top, left } : current));
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    repositionPanel();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !window.visualViewport) return;
    const viewport = window.visualViewport;
    viewport.addEventListener('resize', repositionPanel);
    return () => viewport.removeEventListener('resize', repositionPanel);
  }, [isOpen]);

  useDismissablePanel({ isOpen, onClose: () => setIsOpen(false), refs: [triggerRef, panelRef] });

  const selected = options.find((option) => option.value === value);

  return (
    <div className="status-dot-menu">
      <button
        ref={triggerRef}
        type="button"
        className="status-dot-menu__trigger"
        style={{ width }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
      >
        <span className="status-dot-menu__dot" style={{ background: selected?.dot }} />
        <span className="status-dot-menu__label">{selected?.label}</span>
        <ChevronDown size={14} className="status-dot-menu__chevron" />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="status-dot-menu__panel"
            role="listbox"
            aria-label={ariaLabel}
            style={{ top: position.top, left: position.left, width }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="status-dot-menu__option"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className="status-dot-menu__dot" style={{ background: option.dot }} />
                <span className="status-dot-menu__option-label">{option.label}</span>
                {option.value === value && <Check size={16} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default StatusDotMenu;
