import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

interface UseAnimatedEmailMovesOptions {
  onMoveAsync: (variables: { emailId: string; mailboxIds: Record<string, boolean> }) => Promise<unknown>
  onMoveBulkAsync: (variables: { emailIds: string[]; mailboxIds: Record<string, boolean> }) => Promise<unknown>
}

interface UseAnimatedEmailMovesReturn {
  removingEmailIds: Set<string>
  moveEmailsToFolder: (emailIds: string[], mailboxId: string, folderName: string) => void
  cancelPendingMoves: () => void
}

/**
 * Hook for managing animated email moves.
 * Adds a visual delay before actually moving emails, with cleanup support.
 * Uses mutateAsync so removingEmailIds is only cleared after the mutation
 * fully completes (optimistic cache update + server round-trip).
 */
export function useAnimatedEmailMoves({
  onMoveAsync,
  onMoveBulkAsync,
}: UseAnimatedEmailMovesOptions): UseAnimatedEmailMovesReturn {
  const [removingEmailIds, setRemovingEmailIds] = useState<Set<string>>(new Set())
  const pendingTimersRef = useRef<Set<number>>(new Set())
  const operationCounterRef = useRef(0)
  const isExecutingRef = useRef(false)

  // Cleanup pending timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach(timerId => {
        window.clearTimeout(timerId)
      })
      pendingTimersRef.current.clear()
    }
  }, [])

  const moveEmailsToFolder = useCallback((emailIds: string[], mailboxId: string, folderName: string) => {
    // Increment operation counter to track this specific operation
    const currentOperation = ++operationCounterRef.current
    
    // Clear any pending timers from previous operations to prevent accumulation
    pendingTimersRef.current.forEach(timerId => {
      window.clearTimeout(timerId)
    })
    pendingTimersRef.current.clear()
    
    // Clear previous removing state for clean animation
    setRemovingEmailIds(new Set())

    // Add to removing set for animation
    setRemovingEmailIds(prev => {
      const next = new Set(prev)
      emailIds.forEach(id => next.add(id))
      return next
    })

    // Schedule the actual move
    const timerId = window.setTimeout(async () => {
      pendingTimersRef.current.delete(timerId)

      // Prevent multiple concurrent executions
      // Check both the operation counter AND the executing ref atomically
      if (isExecutingRef.current || operationCounterRef.current !== currentOperation) return
      isExecutingRef.current = true

      // Double-check after acquiring the lock to handle race where
      // a newer operation was started while we were waiting
      if (operationCounterRef.current !== currentOperation) {
        isExecutingRef.current = false
        return
      }

      try {
        if (emailIds.length === 1) {
          await onMoveAsync({ emailId: emailIds[0], mailboxIds: { [mailboxId]: true } })
        } else {
          await onMoveBulkAsync({ emailIds, mailboxIds: { [mailboxId]: true } })
        }

        toast.success(`Moved ${emailIds.length > 1 ? emailIds.length + ' messages' : '1 message'} to ${folderName}`)
      } catch {
        // Mutation's onError already shows error toast and rolls back cache.
      } finally {
        isExecutingRef.current = false

        // Remove from removing set, but only if this was the most recent operation
        if (operationCounterRef.current === currentOperation) {
          setRemovingEmailIds(prev => {
            const next = new Set(prev)
            emailIds.forEach(id => next.delete(id))
            return next
          })
        }
      }
    }, 300)

    pendingTimersRef.current.add(timerId)
  }, [onMoveAsync, onMoveBulkAsync])

  const cancelPendingMoves = useCallback(() => {
    pendingTimersRef.current.forEach(timerId => {
      window.clearTimeout(timerId)
    })
    pendingTimersRef.current.clear()
    setRemovingEmailIds(new Set())
  }, [])

  return {
    removingEmailIds,
    moveEmailsToFolder,
    cancelPendingMoves,
  }
}
