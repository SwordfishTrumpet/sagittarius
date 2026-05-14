import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useListFilters } from '../useListFilters'
import type { FilterState, HeaderFilterEntry } from '../useListFilters'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const EMPTY_FILTERS: FilterState = {
  unread: false,
  flagged: false,
  toMe: false,
  attachments: false,
  headerFilters: [],
}

describe('useListFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty filters by default', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    expect(result.current.activeFilters).toEqual(EMPTY_FILTERS)
    expect(result.current.hasActiveFilters).toBe(false)
    expect(result.current.activeFilterCount).toBe(0)
    expect(result.current.quickJMAPFilter).toBeUndefined()
    expect(result.current.showFilterDialog).toBe(false)
  })

  it('builds single condition for unread filter via applyFilters', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, unread: true })
    })

    expect(result.current.activeFilters.unread).toBe(true)
    expect(result.current.quickJMAPFilter).toEqual({ notHasKeyword: '$seen' })
    expect(result.current.hasActiveFilters).toBe(true)
    expect(result.current.activeFilterCount).toBe(1)
  })

  it('builds single condition for flagged filter', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, flagged: true })
    })

    expect(result.current.activeFilters.flagged).toBe(true)
    expect(result.current.quickJMAPFilter).toEqual({ hasKeyword: '$flagged' })
  })

  it('builds single condition for toMe filter with userEmail', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, toMe: true })
    })

    expect(result.current.quickJMAPFilter).toEqual({ to: 'me@example.com' })
  })

  it('ignores toMe filter when userEmail is empty', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: '' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, toMe: true })
    })

    expect(result.current.quickJMAPFilter).toBeUndefined()
  })

  it('builds single condition for attachments filter', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, attachments: true })
    })

    expect(result.current.quickJMAPFilter).toEqual({ hasAttachment: true })
  })

  it('builds allOf filter when multiple filters active', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, unread: true, flagged: true })
    })

    expect(result.current.quickJMAPFilter).toEqual({
      allOf: [{ notHasKeyword: '$seen' }, { hasKeyword: '$flagged' }],
    })
  })

  it('includes header filter conditions', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({
        ...EMPTY_FILTERS,
        headerFilters: [{ id: '1', headerName: 'List-Id', value: 'newsletter' }],
      })
    })

    expect(result.current.quickJMAPFilter).toEqual({
      header: ['List-Id', 'newsletter'],
    })
    expect(result.current.hasActiveFilters).toBe(true)
    expect(result.current.activeFilterCount).toBe(1)
  })

  it('builds header exists condition when value is empty', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({
        ...EMPTY_FILTERS,
        headerFilters: [{ id: '1', headerName: 'X-Spam-Status', value: '' }],
      })
    })

    expect(result.current.quickJMAPFilter).toEqual({
      header: ['X-Spam-Status'],
    })
  })

  it('ignores header filters with empty header name', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({
        ...EMPTY_FILTERS,
        headerFilters: [{ id: '1', headerName: '', value: 'value' }],
      })
    })

    expect(result.current.quickJMAPFilter).toBeUndefined()
  })

  it('combines header filters with boolean filters', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({
        unread: true,
        flagged: false,
        toMe: false,
        attachments: false,
        headerFilters: [{ id: '1', headerName: 'List-Id', value: 'newsletter' }],
      })
    })

    expect(result.current.quickJMAPFilter).toEqual({
      allOf: [
        { notHasKeyword: '$seen' },
        { header: ['List-Id', 'newsletter'] },
      ],
    })
    expect(result.current.activeFilterCount).toBe(2)
  })

  it('clearFilters removes all active filters', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, unread: true, flagged: true })
    })
    expect(result.current.hasActiveFilters).toBe(true)

    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.activeFilters).toEqual(EMPTY_FILTERS)
    expect(result.current.quickJMAPFilter).toBeUndefined()
    expect(result.current.hasActiveFilters).toBe(false)
  })

  it('toggles dialog visibility', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    expect(result.current.showFilterDialog).toBe(false)

    act(() => {
      result.current.openFilterDialog()
    })
    expect(result.current.showFilterDialog).toBe(true)

    act(() => {
      result.current.closeFilterDialog()
    })
    expect(result.current.showFilterDialog).toBe(false)
  })

  it('applyFilters closes the dialog', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.openFilterDialog()
    })
    expect(result.current.showFilterDialog).toBe(true)

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, unread: true })
    })
    expect(result.current.showFilterDialog).toBe(false)
  })

  it('clearFilters closes the dialog', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.openFilterDialog()
    })
    expect(result.current.showFilterDialog).toBe(true)

    act(() => {
      result.current.clearFilters()
    })
    expect(result.current.showFilterDialog).toBe(false)
  })
})
