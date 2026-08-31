import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
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
}

const VIEWPORT_MARGIN = 8;

function Select({ id, options, value, onChange, ariaLabel, className }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  }

  // Native <select> popups render as a browser-chrome overlay that can
  // overlap the fields below it - fine on a real phone (native OS picker),
  // but on a narrow desktop viewport (or emulated mobile view) it visibly
  // spills over surrounding form content. Rendering our own portaled,
  // viewport-clamped panel avoids that everywhere, same as MultiSelect.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    let top = triggerRect.bottom + 4;
    if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = triggerRect.top - panelRect.height - 4;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    if (top !== position.top) {
      setPosition((current) => ({ ...current, top }));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedTrigger && !clickedPanel) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

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
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
      >
        <span>{selected?.label ?? ''}</span>
        <ChevronDown size={16} className="custom-select__chevron" />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="custom-select__panel"
            role="listbox"
            style={{ top: position.top, left: position.left, width: position.width }}
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
