import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EmailFilter, EmailFilterCondition } from '../types/jmap'

export interface HeaderFilterEntry {
  id: string
  headerName: string
  value: string
}

export interface FilterState {
  unread: boolean
  flagged: boolean
  toMe: boolean
  attachments: boolean
  headerFilters: HeaderFilterEntry[]
}

interface UseListFiltersOptions {
  userEmail: string
}

interface UseListFiltersReturn {
  activeFilters: FilterState
  hasActiveFilters: boolean
  activeFilterCount: number
  quickJMAPFilter: EmailFilter | undefined
  showFilterDialog: boolean
  openFilterDialog: () => void
  closeFilterDialog: () => void
  applyFilters: (filters: FilterState) => void
  clearFilters: () => void
}

const EMPTY_FILTERS: FilterState = {
  unread: false,
  flagged: false,
  toMe: false,
  attachments: false,
  headerFilters: [],
}

export function useListFilters({ userEmail }: UseListFiltersOptions): UseListFiltersReturn {
  const queryClient = useQueryClient()
  const [activeFilters, setActiveFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const previousFiltersKeyRef = useRef('')
  const initializedRef = useRef(false)

  const openFilterDialog = useCallback(() => setShowFilterDialog(true), [])
  const closeFilterDialog = useCallback(() => setShowFilterDialog(false), [])

  const applyFilters = useCallback((filters: FilterState) => {
    setActiveFilters(filters)
    setShowFilterDialog(false)
  }, [])

  const clearFilters = useCallback(() => {
    setActiveFilters(EMPTY_FILTERS)
    setShowFilterDialog(false)
  }, [])

  // Invalidate threads query when filters change
  useEffect(() => {
    const key = JSON.stringify(activeFilters)
    if (!initializedRef.current) {
      initializedRef.current = true
      previousFiltersKeyRef.current = key
      return
    }
    if (key !== previousFiltersKeyRef.current) {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      previousFiltersKeyRef.current = key
    }
  }, [activeFilters, queryClient])

  // Build JMAP filter from active filters
  const quickJMAPFilter = useMemo(() => {
    const conditions: EmailFilterCondition[] = []

    if (activeFilters.unread) {
      conditions.push({ notHasKeyword: '$seen' })
    }
    if (activeFilters.flagged) {
      conditions.push({ hasKeyword: '$flagged' })
    }
    if (activeFilters.toMe && userEmail) {
      conditions.push({ to: userEmail })
    }
    if (activeFilters.attachments) {
      conditions.push({ hasAttachment: true })
    }

    for (const hf of activeFilters.headerFilters) {
      if (hf.headerName.trim()) {
        const header: string[] = [hf.headerName.trim()]
        if (hf.value.trim()) header.push(hf.value.trim())
        conditions.push({ header })
      }
    }

    if (conditions.length === 0) return undefined
    if (conditions.length === 1) return conditions[0]
    return { allOf: conditions }
  }, [activeFilters, userEmail])

  const hasActiveFilters =
    activeFilters.unread ||
    activeFilters.flagged ||
    activeFilters.toMe ||
    activeFilters.attachments ||
    activeFilters.headerFilters.length > 0

  const activeFilterCount =
    (activeFilters.unread ? 1 : 0) +
    (activeFilters.flagged ? 1 : 0) +
    (activeFilters.toMe ? 1 : 0) +
    (activeFilters.attachments ? 1 : 0) +
    activeFilters.headerFilters.length

  return {
    activeFilters,
    hasActiveFilters,
    activeFilterCount,
    quickJMAPFilter,
    showFilterDialog,
    openFilterDialog,
    closeFilterDialog,
    applyFilters,
    clearFilters,
  }
}
