/**
 * useSnooze tests — BUG-2026-041 (past dates must not leave $snoozed forever)
 * and BUG-2026-042 (pending unsnooze timers cleared on unmount).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('../jmap/useEmailMutations', () => ({
  useEmailActions: () => ({
    updateKeywords: { mutate: vi.fn() },
  }),
}))

import { useSnooze } from '../useSnooze'
import { toast } from 'sonner'

const SNOOZE_STORAGE_KEY = 'sagittarius_snoozed_emails'

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return Wrapper
}

describe('useSnooze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('rejects past snooze dates instead of leaving $snoozed set forever (BUG-2026-041)', () => {
    const { result } = renderHook(() => useSnooze(), { wrapper: makeWrapper() })

    const past = new Date(Date.now() - 60_000)
    act(() => {
      result.current.snoozeEmail('email-1', past)
    })

    // No keyword mutation, no persisted record, and the user is told why
    expect(toast.error).toHaveBeenCalledWith('Snooze time must be in the future')
    const records = JSON.parse(sessionStorage.getItem(SNOOZE_STORAGE_KEY) || '[]')
    expect(records).toHaveLength(0)
    expect(result.current.isSnoozed('email-1')).toBe(false)
  })

  it('snoozes future dates and persists the record', () => {
    const { result } = renderHook(() => useSnooze(), { wrapper: makeWrapper() })

    const future = new Date(Date.now() + 60 * 60 * 1000)
    act(() => {
      result.current.snoozeEmail('email-1', future)
    })

    const records = JSON.parse(sessionStorage.getItem(SNOOZE_STORAGE_KEY) || '[]')
    expect(records).toHaveLength(1)
    expect(records[0].emailId).toBe('email-1')
    expect(result.current.isSnoozed('email-1')).toBe(true)
    expect(result.current.getSnoozedUntil('email-1')?.getTime()).toBe(future.getTime())
  })

  it('clears pending unsnooze timers on unmount (BUG-2026-042)', () => {
    vi.useFakeTimers()
    try {
      const { result, unmount } = renderHook(() => useSnooze(), { wrapper: makeWrapper() })

      const future = new Date(Date.now() + 60 * 60 * 1000)
      act(() => {
        result.current.snoozeEmail('email-1', future)
      })

      unmount()

      // Advancing time past the unsnooze point must NOT fire the mutation or
      // invalidations after unmount.
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 60 * 1000)
      })

      // The record remains (no unsnooze happened), proving the timer was cleared.
      const records = JSON.parse(sessionStorage.getItem(SNOOZE_STORAGE_KEY) || '[]')
      expect(records).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('unsnoozeEmail clears the record and timer', () => {
    const { result } = renderHook(() => useSnooze(), { wrapper: makeWrapper() })

    const future = new Date(Date.now() + 60 * 60 * 1000)
    act(() => {
      result.current.snoozeEmail('email-1', future)
      result.current.unsnoozeEmail('email-1')
    })

    const records = JSON.parse(sessionStorage.getItem(SNOOZE_STORAGE_KEY) || '[]')
    expect(records).toHaveLength(0)
    expect(result.current.isSnoozed('email-1')).toBe(false)
  })
})
