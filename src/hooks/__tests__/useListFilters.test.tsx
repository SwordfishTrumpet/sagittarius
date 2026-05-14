import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useListFilters, AVAILABLE_FILTERS } from '../useListFilters'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useListFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty filters by default', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    expect(result.current.activeListFilters.size).toBe(0)
    expect(result.current.showFilterBar).toBe(false)
    expect(result.current.quickJMAPFilter).toBeUndefined()
  })

  it('toggles a filter on', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.toggleFilter('unread')
    })

    expect(result.current.activeListFilters.has('unread')).toBe(true)
    expect(result.current.quickJMAPFilter).toEqual({ notHasKeyword: '$seen' })
  })

  it('toggles a filter off when already active', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.toggleFilter('unread')
    })
    expect(result.current.activeListFilters.has('unread')).toBe(true)

    act(() => {
      result.current.toggleFilter('unread')
    })
    expect(result.current.activeListFilters.has('unread')).toBe(false)
    expect(result.current.quickJMAPFilter).toBeUndefined()
  })

  it('builds allOf filter when multiple filters active', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.toggleFilter('unread')
      result.current.toggleFilter('flagged')
    })

    expect(result.current.quickJMAPFilter).toEqual({
      allOf: [{ notHasKeyword: '$seen' }, { hasKeyword: '$flagged' }],
    })
  })

  it('includes toMe filter with userEmail', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.toggleFilter('toMe')
    })

    expect(result.current.quickJMAPFilter).toEqual({ to: 'me@example.com' })
  })

  it('ignores toMe filter when userEmail is empty', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: '' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.toggleFilter('toMe')
    })

    expect(result.current.quickJMAPFilter).toBeUndefined()
  })

  it('includes attachments filter', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.toggleFilter('attachments')
    })

    expect(result.current.quickJMAPFilter).toEqual({ hasAttachment: true })
  })

  it('clearFilters removes all active filters', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.toggleFilter('unread')
      result.current.toggleFilter('flagged')
      result.current.clearFilters()
    })

    expect(result.current.activeListFilters.size).toBe(0)
    expect(result.current.quickJMAPFilter).toBeUndefined()
  })

  it('toggles filter bar visibility', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    expect(result.current.showFilterBar).toBe(false)

    act(() => {
      result.current.toggleFilterBar()
    })
    expect(result.current.showFilterBar).toBe(true)

    act(() => {
      result.current.toggleFilterBar()
    })
    expect(result.current.showFilterBar).toBe(false)
  })

  it('setShowFilterBar sets visibility directly', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setShowFilterBar(true)
    })
    expect(result.current.showFilterBar).toBe(true)

    act(() => {
      result.current.setShowFilterBar(false)
    })
    expect(result.current.showFilterBar).toBe(false)
  })

  it('has correct available filters metadata', () => {
    expect(AVAILABLE_FILTERS).toHaveLength(4)
    expect(AVAILABLE_FILTERS.map(f => f.id)).toEqual(['unread', 'flagged', 'toMe', 'attachments'])
  })
})
