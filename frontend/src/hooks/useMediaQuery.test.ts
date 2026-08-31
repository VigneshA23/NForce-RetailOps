import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

function mockMatchMedia(initialMatches: boolean) {
  let changeHandler: (() => void) | null = null
  let matches = initialMatches

  const mediaQueryList = {
    get matches() {
      return matches
    },
    media: '',
    onchange: null,
    addEventListener: vi.fn((_event: string, handler: () => void) => {
      changeHandler = handler
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  window.matchMedia = vi.fn().mockReturnValue(mediaQueryList)

  return {
    setMatches(next: boolean) {
      matches = next
      changeHandler?.()
    },
  }
}

describe('useMediaQuery', () => {
  it('returns the initial match state', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(max-width: 480px)'))
    expect(result.current).toBe(true)
  })

  it('updates when the media query match changes', () => {
    const { setMatches } = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 480px)'))
    expect(result.current).toBe(false)

    act(() => {
      setMatches(true)
    })

    expect(result.current).toBe(true)
  })
})
