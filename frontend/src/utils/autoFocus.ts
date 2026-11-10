// Touch devices open the on-screen keyboard the moment an input is focused, so
// forms must not grab focus on open there -- the keyboard should appear only
// when the user taps a field themselves. Desktop keeps the autofocus.
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
}

export const shouldAutoFocus = (): boolean => !isTouchDevice();
