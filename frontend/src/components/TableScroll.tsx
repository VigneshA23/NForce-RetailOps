import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './TableScroll.css';

interface TableScrollProps {
  children: ReactNode;
}

interface ThumbState {
  widthPct: number;
  leftPct: number;
}

// The shared `.table-scroll` wrapper plus an in-page scrollbar for touch
// screens. Tablets/phones use overlay scrollbars that browsers hide until you
// scroll, so a table wider than its card looks silently clipped there; the bar
// below is always drawn (touch devices only -- desktop keeps the native,
// styled scrollbar from styles/table.css) and hidden when the table fits.
function TableScroll({ children }: TableScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<ThumbState | null>(null);
  // True while the table is being scrolled (and ~0.8s after), so the
  // hover-revealed scrollbar (TableScroll.css) also shows during touch swipes
  // and keyboard scrolling, not only while the pointer is over the table.
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollIdleTimer = useRef<number | undefined>(undefined);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 1) {
      setThumb(null);
      return;
    }
    const widthPct = Math.max((el.clientWidth / el.scrollWidth) * 100, 12);
    const leftPct = (el.scrollLeft / overflow) * (100 - widthPct);
    setThumb({ widthPct, leftPct });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    function onScroll() {
      update();
      setIsScrolling(true);
      window.clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = window.setTimeout(() => setIsScrolling(false), 800);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(el);
      if (el.firstElementChild) observer.observe(el.firstElementChild);
    }
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(scrollIdleTimer.current);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [update]);

  // Dragging the thumb (or tapping the track) scrolls the table.
  function scrollToPointer(clientX: number) {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track || !thumb) return;
    const rect = track.getBoundingClientRect();
    const thumbPx = (thumb.widthPct / 100) * rect.width;
    const ratio = (clientX - rect.left - thumbPx / 2) / (rect.width - thumbPx);
    el.scrollLeft = Math.min(Math.max(ratio, 0), 1) * (el.scrollWidth - el.clientWidth);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    scrollToPointer(event.clientX);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollToPointer(event.clientX);
  }

  return (
    <div className={`table-scroll-wrap${isScrolling ? ' table-scroll-wrap--scrolling' : ''}`}>
      <div ref={scrollRef} className="table-scroll">
        {children}
      </div>
      {thumb && (
        <div
          ref={trackRef}
          className="table-scroll-wrap__track"
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <div
            className="table-scroll-wrap__thumb"
            style={{ width: `${thumb.widthPct}%`, left: `${thumb.leftPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default TableScroll;
