import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { SearchFilter } from '../types/search'

export interface HeaderFilterEntry {
  id: string
  headerName: string
  value: string
}

export interface FilterState {
  unread: boolean
  starred: boolean
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
  dialogSearchFilter: SearchFilter | undefined
  showFilterDialog: boolean
  openFilterDialog: () => void
  closeFilterDialog: () => void
  applyFilters: (filters: FilterState) => void
  clearFilters: () => void
}

const EMPTY_FILTERS: FilterState = {
  unread: false,
  starred: false,
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

  // Build SearchFilter from dialog FilterState
  const dialogSearchFilter = useMemo(() => {
    const filter: Partial<SearchFilter> = {}

    if (activeFilters.unread) {
      filter.isUnread = true
    }
    if (activeFilters.starred) {
      filter.isFlagged = true
    }
    if (activeFilters.toMe && userEmail) {
      filter.to = userEmail
    }
    if (activeFilters.attachments) {
      filter.hasAttachment = true
    }

    const validHeaderFilters = activeFilters.headerFilters.filter(hf => hf.headerName.trim())
    if (validHeaderFilters.length > 0) {
      filter.headerFilters = validHeaderFilters.map(hf => ({
        headerName: hf.headerName.trim(),
        value: hf.value.trim() || undefined,
      }))
    }

    return Object.keys(filter).length > 0 ? (filter as SearchFilter) : undefined
  }, [activeFilters, userEmail])

  const hasActiveFilters =
    activeFilters.unread ||
    activeFilters.starred ||
    activeFilters.toMe ||
    activeFilters.attachments ||
    activeFilters.headerFilters.length > 0

  const activeFilterCount =
    (activeFilters.unread ? 1 : 0) +
    (activeFilters.starred ? 1 : 0) +
    (activeFilters.toMe ? 1 : 0) +
    (activeFilters.attachments ? 1 : 0) +
    activeFilters.headerFilters.length

  return {
    activeFilters,
    hasActiveFilters,
    activeFilterCount,
    dialogSearchFilter,
    showFilterDialog,
    openFilterDialog,
    closeFilterDialog,
    applyFilters,
    clearFilters,
  }
}
