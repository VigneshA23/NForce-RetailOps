import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface VisibleItemsScrollProps {
  className: string;
  // How many children to show before the rest scroll.
  maxVisible: number;
  children: ReactNode;
}

// A scroll container capped at exactly `maxVisible` children tall. Children
// vary in height (e.g. checklist tasks with a text box vs. a single button),
// so a fixed max-height can't do this -- the cap is measured from the Nth
// child and exposed as --visible-items-max-height, which the component's CSS
// applies (so a media query can still turn the cap off, e.g. on mobile).
function VisibleItemsScroll({ className, maxVisible, children }: VisibleItemsScrollProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      const items = el.children;
      if (items.length <= maxVisible) {
        el.style.setProperty('--visible-items-max-height', 'none');
        return;
      }
      const last = items[maxVisible - 1] as HTMLElement;
      // Container is position: relative, so offsetTop is measured from its
      // padding edge; clientTop adds the top border (box-sizing: border-box).
      const height = el.clientTop + last.offsetTop + last.offsetHeight;
      el.style.setProperty('--visible-items-max-height', height > 0 ? `${height}px` : 'none');
    }

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default VisibleItemsScroll;
