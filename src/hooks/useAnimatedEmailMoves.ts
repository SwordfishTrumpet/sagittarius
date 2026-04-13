import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

interface UseAnimatedEmailMovesOptions {
  onMove: (variables: { emailId: string; mailboxIds: Record<string, boolean> }) => void
  onMoveBulk: (variables: { emailIds: string[]; mailboxIds: Record<string, boolean> }) => void
}

interface UseAnimatedEmailMovesReturn {
  removingEmailIds: Set<string>
  moveEmailsToFolder: (emailIds: string[], mailboxId: string, folderName: string) => void
  cancelPendingMoves: () => void
}

/**
 * Hook for managing animated email moves.
 * Adds a visual delay before actually moving emails, with cleanup support.
 */
export function useAnimatedEmailMoves({
  onMove,
  onMoveBulk,
}: UseAnimatedEmailMovesOptions): UseAnimatedEmailMovesReturn {
  const [removingEmailIds, setRemovingEmailIds] = useState<Set<string>>(new Set())
  const pendingTimersRef = useRef<Set<number>>(new Set())
  const operationCounterRef = useRef(0)

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
    const timerId = window.setTimeout(() => {
      // Only execute if this is still the most recent operation
      if (operationCounterRef.current !== currentOperation) {
        pendingTimersRef.current.delete(timerId)
        return
      }
      
      pendingTimersRef.current.delete(timerId)

      if (emailIds.length === 1) {
        onMove({ emailId: emailIds[0], mailboxIds: { [mailboxId]: true } })
      } else {
        onMoveBulk({ emailIds, mailboxIds: { [mailboxId]: true } })
      }

      toast.success(`Moved ${emailIds.length > 1 ? emailIds.length + ' messages' : '1 message'} to ${folderName}`)

      // Remove from removing set
      setRemovingEmailIds(prev => {
        const next = new Set(prev)
        emailIds.forEach(id => next.delete(id))
        return next
      })
    }, 300)

    pendingTimersRef.current.add(timerId)
  }, [onMove, onMoveBulk])

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
