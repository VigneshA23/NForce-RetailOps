import '@testing-library/jest-dom'

// jsdom has no ResizeObserver, and Recharts' ResponsiveContainer constructs one
// on mount -- so any test rendering a page with a chart throws without this.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom has no Pointer Events capture API -- Radix UI's pointer-based
// components (Select, and other Radix primitives adopted alongside shadcn)
// call Element.hasPointerCapture/setPointerCapture/releasePointerCapture
// internally, which throws under jsdom without this polyfill.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}

// Page-level sub-navigation persists to localStorage (usePersistedState);
// don't let one test's sub-tab leak into the next.
afterEach(() => {
  localStorage.clear()
})
