import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import SearchInput from './SearchInput';
import './MultiSelect.css';

export interface MultiSelectOption {
  id: number;
  label: string;
}

interface MultiSelectProps {
  id?: string;
  options: MultiSelectOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setQuery('');
    setIsOpen(true);
  }

  // Same fix as RowActionsMenu: the panel's height isn't known until it
  // renders, so flip it above the trigger if opening below would push it
  // past the bottom of the viewport - otherwise a field low in a form (or on
  // a short viewport) opens a panel that's partly unreachable.
  //
  // Uses visualViewport's height, not window.innerHeight -- tapping this
  // panel's own search field raises the on-screen keyboard on a real phone.
  // iOS Safari shrinks visualViewport (not the layout viewport) for that and
  // does NOT fire a window 'resize' event, so a flip computed off
  // window.innerHeight stays sized for the pre-keyboard viewport and the
  // panel ends up rendered under the keyboard.
  function repositionPanel() {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 8;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    let top = triggerRect.bottom + 4;
    if (top + panelRect.height > viewportHeight - margin) {
      top = triggerRect.top - panelRect.height - 4;
    }
    top = Math.max(margin, top);

    setPosition((current) => (top !== current.top ? { ...current, top } : current));
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    repositionPanel();
  }, [isOpen]);

  // Re-run the same flip logic when the on-screen keyboard opens/closes,
  // instead of just closing the panel -- visualViewport is what actually
  // changes size in that case, and only some browsers also fire a window
  // 'resize' for it.
  useEffect(() => {
    if (!isOpen || !window.visualViewport) return;
    const viewport = window.visualViewport;
    viewport.addEventListener('resize', repositionPanel);
    return () => viewport.removeEventListener('resize', repositionPanel);
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
        // Capture phase + stopPropagation: when this panel is rendered inside
        // a Modal, Modal's own bubble-phase Escape listener on `document`
        // would otherwise also fire and close the whole modal underneath us.
        event.stopPropagation();
        setIsOpen(false);
      }
    }

    // Simplest robust fix for a portal-rendered panel: close on scroll rather
    // than tracking the trigger's position continuously.
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

  function toggleOpen() {
    isOpen ? setIsOpen(false) : openPanel();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleOpen();
    }
  }

  function toggleOption(optionId: number) {
    if (value.includes(optionId)) {
      onChange(value.filter((selectedId) => selectedId !== optionId));
    } else {
      onChange([...value, optionId]);
    }
  }

  function removeOption(optionId: number, event: ReactMouseEvent) {
    event.stopPropagation();
    onChange(value.filter((selectedId) => selectedId !== optionId));
  }

  const selectedOptions = options.filter((option) => value.includes(option.id));
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="multi-select">
      <div
        ref={triggerRef}
        id={id}
        className="multi-select__trigger"
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        {selectedOptions.length === 0 ? (
          <span className="multi-select__placeholder">{placeholder}</span>
        ) : (
          <span className="multi-select__chips">
            {selectedOptions.map((option) => (
              <span key={option.id} className="badge badge--outline multi-select__chip">
                {option.label}
                <button
                  type="button"
                  className="multi-select__chip-remove"
                  aria-label={`Remove ${option.label}`}
                  onClick={(event) => removeOption(option.id, event)}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </span>
        )}
        <ChevronDown size={16} className="multi-select__chevron" />
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="multi-select__panel"
            role="listbox"
            aria-multiselectable="true"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="multi-select__search">
              <SearchInput variant="card" value={query} onChange={setQuery} placeholder={searchPlaceholder} />
            </div>
            <div className="multi-select__options">
              {filteredOptions.length === 0 ? (
                <div className="multi-select__empty">No stores found</div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`multi-select__option${isSelected ? ' multi-select__option--selected' : ''}`}
                      onClick={() => toggleOption(option.id)}
                    >
                      <span className="multi-select__option-check">{isSelected && <Check size={14} />}</span>
                      {option.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default MultiSelect;
