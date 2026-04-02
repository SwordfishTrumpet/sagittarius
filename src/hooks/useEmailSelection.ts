import { useState, useCallback, useMemo } from 'react'
import type { Email } from '../types/jmap'

interface UseEmailSelectionOptions {
  emails: Email[] | undefined
}

interface UseEmailSelectionReturn {
  selectedEmailId: string | null
  selectedThreadId: string | null
  selectedEmailIds: Set<string>
  setSelectedEmailId: (id: string | null) => void
  setSelectedThreadId: (id: string | null) => void
  setSelectedEmailIds: (ids: Set<string>) => void
  resetSelection: () => void
  toggleEmailSelection: (emailId: string, ctrlKey: boolean, shiftKey: boolean) => void
  selectAllEmails: () => void
  clearSelection: () => void
  selectedEmail: Email | undefined
}

/**
 * Hook for managing email selection state.
 * Handles single selection, multi-selection with Ctrl/Cmd, range selection with Shift,
 * and selecting all/clearing selection.
 */
export function useEmailSelection({ emails }: UseEmailSelectionOptions): UseEmailSelectionReturn {
  const [selectedEmailId, setSelectedEmailIdState] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadIdState] = useState<string | null>(null)
  const [selectedEmailIds, setSelectedEmailIdsState] = useState<Set<string>>(new Set())

  const resetSelection = useCallback(() => {
    setSelectedEmailIdState(null)
    setSelectedThreadIdState(null)
    setSelectedEmailIdsState(new Set())
  }, [])

  const toggleEmailSelection = useCallback((emailId: string, ctrlKey: boolean, shiftKey: boolean) => {
    // Use functional update to avoid stale closure issues
    setSelectedEmailIdsState((prevSelectedIds) => {
      const newSelection = new Set(prevSelectedIds)

      if (shiftKey && selectedEmailId && emails) {
        // Shift+click: select range
        const currentIndex = emails.findIndex((e) => e.id === selectedEmailId)
        const clickedIndex = emails.findIndex((e) => e.id === emailId)
        const start = Math.min(currentIndex, clickedIndex)
        const end = Math.max(currentIndex, clickedIndex)
        for (let i = start; i <= end; i++) {
          newSelection.add(emails[i].id)
        }
      } else if (ctrlKey) {
        // Ctrl/Cmd+click: toggle individual
        if (newSelection.has(emailId)) {
          newSelection.delete(emailId)
        } else {
          newSelection.add(emailId)
        }
      } else {
        // Regular click: select only this one
        newSelection.clear()
        newSelection.add(emailId)
      }

      return newSelection
    })

    // These can be set directly as they don't depend on the previous state
    setSelectedEmailIdState(emailId)
    setSelectedThreadIdState(emails?.find((e) => e.id === emailId)?.threadId || null)
  }, [selectedEmailId, emails])

  const selectAllEmails = useCallback(() => {
    if (emails) {
      const allIds = new Set<string>(emails.map((e) => e.id))
      setSelectedEmailIdsState(allIds)
    }
  }, [emails])

  const clearSelection = useCallback(() => {
    setSelectedEmailIdsState(new Set())
  }, [])

  const setSelectedEmailId = useCallback((id: string | null) => {
    setSelectedEmailIdState(id)
    if (id && emails) {
      setSelectedThreadIdState(emails.find((e) => e.id === id)?.threadId || null)
    }
  }, [emails])

  const setSelectedThreadId = useCallback((id: string | null) => {
    setSelectedThreadIdState(id)
  }, [])

  const setSelectedEmailIds = useCallback((ids: Set<string>) => {
    setSelectedEmailIdsState(ids)
  }, [])

  // Computed: get the currently selected email object
  const selectedEmail = useMemo(() => {
    return emails?.find((e) => e.id === selectedEmailId)
  }, [emails, selectedEmailId])

  return {
    selectedEmailId,
    selectedThreadId,
    selectedEmailIds,
    setSelectedEmailId,
    setSelectedThreadId,
    setSelectedEmailIds,
    resetSelection,
    toggleEmailSelection,
    selectAllEmails,
    clearSelection,
    selectedEmail,
  }
}
