import { useState, useCallback, useMemo } from 'react'

export interface ListFilter {
  id: string
  label: string
  jmapCondition: Record<string, any>
}

interface UseListFiltersOptions {
  userEmail: string
}

interface UseListFiltersReturn {
  activeListFilters: Set<string>
  showFilterBar: boolean
  quickJMAPFilter: Record<string, any> | undefined
  toggleFilter: (filterId: string) => void
  setShowFilterBar: (show: boolean) => void
  toggleFilterBar: () => void
  clearFilters: () => void
}

/**
 * Available list filters with their JMAP filter conditions.
 */
export const AVAILABLE_FILTERS: ListFilter[] = [
  { id: 'unread', label: 'Unread', jmapCondition: { notHasKeyword: '$seen' } },
  { id: 'flagged', label: 'Flagged', jmapCondition: { hasKeyword: '$flagged' } },
  { id: 'toMe', label: 'To Me', jmapCondition: { to: [] } }, // to condition populated dynamically
  { id: 'attachments', label: 'Attachments', jmapCondition: { hasAttachment: true } },
]

/**
 * Hook for managing message list filters.
 * Handles filter toggling, building JMAP filter conditions, and UI state.
 */
export function useListFilters({ userEmail }: UseListFiltersOptions): UseListFiltersReturn {
  const [activeListFilters, setActiveListFilters] = useState<Set<string>>(new Set())
  const [showFilterBar, setShowFilterBarState] = useState(false)

  const toggleFilter = useCallback((filterId: string) => {
    setActiveListFilters(prev => {
      const next = new Set(prev)
      if (next.has(filterId)) {
        next.delete(filterId)
      } else {
        next.add(filterId)
      }
      return next
    })
  }, [])

  const setShowFilterBar = useCallback((show: boolean) => {
    setShowFilterBarState(show)
  }, [])

  const toggleFilterBar = useCallback(() => {
    setShowFilterBarState(prev => !prev)
  }, [])

  const clearFilters = useCallback(() => {
    setActiveListFilters(new Set())
  }, [])

  // Build JMAP filter from active quick filters
  const quickJMAPFilter = useMemo(() => {
    if (activeListFilters.size === 0) return undefined

    const conditions: Record<string, any>[] = []

    if (activeListFilters.has('unread')) {
      conditions.push({ notHasKeyword: '$seen' })
    }
    if (activeListFilters.has('flagged')) {
      conditions.push({ hasKeyword: '$flagged' })
    }
    if (activeListFilters.has('toMe') && userEmail) {
      conditions.push({ to: [{ email: userEmail }] })
    }
    if (activeListFilters.has('attachments')) {
      conditions.push({ hasAttachment: true })
    }

    if (conditions.length === 0) return undefined
    if (conditions.length === 1) return conditions[0]
    return { allOf: conditions }
  }, [activeListFilters, userEmail])

  return {
    activeListFilters,
    showFilterBar,
    quickJMAPFilter,
    toggleFilter,
    setShowFilterBar,
    toggleFilterBar,
    clearFilters,
  }
}
