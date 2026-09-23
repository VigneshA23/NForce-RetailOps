import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  // 'left' (default): panel's left edge lines up with the trigger's left
  // edge, growing rightward -- fine when there's room to the right. 'right':
  // panel's right edge lines up with the trigger's right edge instead,
  // growing leftward -- for a trigger already sitting at the right edge of
  // its own container (e.g. a card header's period dropdown), where growing
  // rightward has nowhere to go and pushes the panel past the container.
  align?: 'left' | 'right';
}

const VIEWPORT_MARGIN = 8;

function Select({ id, options, value, onChange, ariaLabel, className, placeholder, disabled, align = 'left' }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Placeholder position for the very first paint -- the panel's real
      // (possibly wider) rendered width isn't known until repositionPanel
      // measures it just after, via useLayoutEffect below.
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  }

  // Native <select> popups render as a browser-chrome overlay that can
  // overlap the fields below it - fine on a real phone (native OS picker),
  // but on a narrow desktop viewport (or emulated mobile view) it visibly
  // spills over surrounding form content. Rendering our own portaled,
  // viewport-clamped panel avoids that everywhere, same as MultiSelect.
  //
  // Uses visualViewport's height, not window.innerHeight -- opening this
  // panel can happen while the on-screen keyboard is already up (e.g. a
  // filter row above a focused text field), and iOS Safari shrinks
  // visualViewport without firing a window 'resize' event for it.
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

    // Clamp horizontally too -- a narrow trigger near the right edge of a
    // mobile viewport can otherwise leave the (wider) option panel rendered
    // partly off-screen.
    let left = align === 'right' ? triggerRect.right - panelRect.width : triggerRect.left;
    left = Math.min(left, viewportWidth - panelRect.width - VIEWPORT_MARGIN);
    left = Math.max(VIEWPORT_MARGIN, left);

    setPosition((current) => (top !== current.top || left !== current.left ? { ...current, top, left } : current));
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
    <div className={`custom-select${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`select custom-select__trigger${isOpen ? ' custom-select__trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
      >
        <span>{selected?.label ?? placeholder ?? ''}</span>
        <ChevronDown size={16} className="custom-select__chevron" />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="custom-select__panel"
            role="listbox"
            style={{ top: position.top, left: position.left, minWidth: position.width }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`custom-select__option${option.value === value ? ' custom-select__option--selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className="custom-select__option-check">
                  {option.value === value && <Check size={14} />}
                </span>
                {option.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default Select;
