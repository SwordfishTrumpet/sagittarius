import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useListFilters } from '../useListFilters'
import type { FilterState } from '../useListFilters'

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
  starred: false,
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
    expect(result.current.dialogSearchFilter).toBeUndefined()
    expect(result.current.showFilterDialog).toBe(false)
  })

  it('builds SearchFilter with isUnread for unread filter via applyFilters', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, unread: true })
    })

    expect(result.current.activeFilters.unread).toBe(true)
    expect(result.current.dialogSearchFilter).toEqual({ isUnread: true })
    expect(result.current.hasActiveFilters).toBe(true)
    expect(result.current.activeFilterCount).toBe(1)
  })

  it('builds SearchFilter with isFlagged for starred filter', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, starred: true })
    })

    expect(result.current.activeFilters.starred).toBe(true)
    expect(result.current.dialogSearchFilter).toEqual({ isFlagged: true })
  })

  it('builds SearchFilter with to for toMe filter with userEmail', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, toMe: true })
    })

    expect(result.current.dialogSearchFilter).toEqual({ to: 'me@example.com' })
  })

  it('ignores toMe filter when userEmail is empty', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: '' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, toMe: true })
    })

    expect(result.current.dialogSearchFilter).toBeUndefined()
  })

  it('builds SearchFilter with hasAttachment for attachments filter', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, attachments: true })
    })

    expect(result.current.dialogSearchFilter).toEqual({ hasAttachment: true })
  })

  it('merges multiple fields into a single SearchFilter when multiple filters active', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, unread: true, starred: true })
    })

    expect(result.current.dialogSearchFilter).toEqual({
      isUnread: true,
      isFlagged: true,
    })
  })

  it('includes header filters as headerFilters array', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({
        ...EMPTY_FILTERS,
        headerFilters: [{ id: '1', headerName: 'List-Id', value: 'newsletter' }],
      })
    })

    expect(result.current.dialogSearchFilter).toEqual({
      headerFilters: [{ headerName: 'List-Id', value: 'newsletter' }],
    })
    expect(result.current.hasActiveFilters).toBe(true)
    expect(result.current.activeFilterCount).toBe(1)
  })

  it('omits value from header filter when empty (header existence check)', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({
        ...EMPTY_FILTERS,
        headerFilters: [{ id: '1', headerName: 'X-Spam-Status', value: '' }],
      })
    })

    expect(result.current.dialogSearchFilter).toEqual({
      headerFilters: [{ headerName: 'X-Spam-Status' }],
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

    expect(result.current.dialogSearchFilter).toBeUndefined()
  })

  it('combines header filters with boolean filters in single SearchFilter', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({
        unread: true,
  starred: false,
        toMe: false,
        attachments: false,
        headerFilters: [{ id: '1', headerName: 'List-Id', value: 'newsletter' }],
      })
    })

    expect(result.current.dialogSearchFilter).toEqual({
      isUnread: true,
      headerFilters: [{ headerName: 'List-Id', value: 'newsletter' }],
    })
    expect(result.current.activeFilterCount).toBe(2)
  })

  it('clearFilters removes all active filters and resets dialogSearchFilter', () => {
    const { result } = renderHook(() => useListFilters({ userEmail: 'me@example.com' }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.applyFilters({ ...EMPTY_FILTERS, unread: true, starred: true })
    })
    expect(result.current.hasActiveFilters).toBe(true)

    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.activeFilters).toEqual(EMPTY_FILTERS)
    expect(result.current.dialogSearchFilter).toBeUndefined()
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
