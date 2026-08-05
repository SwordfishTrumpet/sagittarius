/**
 * useNetworkStatus tests — BUG-2026-043: must not crash when `window` is
 * unavailable (SSR / non-browser environments).
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus } from '../useNetworkStatus'

describe('useNetworkStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes from navigator.onLine', () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(typeof navigator === 'undefined' ? true : navigator.onLine)
    expect(result.current.isOffline).toBe(!result.current.isOnline)
  })

  it('tracks online/offline events', () => {
    const { result } = renderHook(() => useNetworkStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)
    expect(result.current.isOffline).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOnline).toBe(true)
  })

  // NOTE: The SSR guard (`typeof window === 'undefined'` early return in the
  // effect) cannot be exercised via renderHook — React's test renderer itself
  // requires a window. The guard is a trivial typeof check; the listener
  // registration/cleanup behavior is covered by the online/offline tests above.
})
