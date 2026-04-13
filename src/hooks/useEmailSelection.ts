import { useState, useCallback, useMemo, useRef } from 'react'
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
  
  // Use a ref to store the anchor email ID for shift+click range selection
  // This avoids stale closure issues when rapidly clicking
  const anchorEmailIdRef = useRef<string | null>(null)

  const resetSelection = useCallback(() => {
    setSelectedEmailIdState(null)
    setSelectedThreadIdState(null)
    setSelectedEmailIdsState(new Set())
    anchorEmailIdRef.current = null
  }, [])

  const toggleEmailSelection = useCallback((emailId: string, ctrlKey: boolean, shiftKey: boolean) => {
    // Use functional update to avoid stale closure issues
    setSelectedEmailIdsState((prevSelectedIds) => {
      const newSelection = new Set(prevSelectedIds)
      
      // Use the ref for shift selections to ensure consistent anchor point
      const anchorId = anchorEmailIdRef.current

      if (shiftKey && anchorId && emails) {
        // Shift+click: select range from anchor to clicked email
        const anchorIndex = emails.findIndex((e) => e.id === anchorId)
        const clickedIndex = emails.findIndex((e) => e.id === emailId)
        const start = Math.min(anchorIndex, clickedIndex)
        const end = Math.max(anchorIndex, clickedIndex)
        // Only proceed if both indices are valid
        if (start !== -1 && end !== -1) {
          for (let i = start; i <= end; i++) {
            newSelection.add(emails[i].id)
          }
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

    // Update the anchor point on non-shift clicks
    if (!shiftKey) {
      anchorEmailIdRef.current = emailId
    }
    
    // These can be set directly as they don't depend on the previous state
    setSelectedEmailIdState(emailId)
    setSelectedThreadIdState(emails?.find((e) => e.id === emailId)?.threadId || null)
  }, [emails])

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
