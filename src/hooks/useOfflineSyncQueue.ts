import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetworkStatus } from './useNetworkStatus'
import { invalidateEmailQueries } from './jmap/queryCacheUtils'
import {
  getDeferredMutationCount,
  replayDeferredMutations,
  subscribeOfflineQueueChanges,
} from '../utils/offlineSyncQueue'

export function useOfflineSyncQueue() {
  const queryClient = useQueryClient()
  const { isOnline } = useNetworkStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)
  const replayLockRef = useRef(false)
  const mountedRef = useRef(false)
  const lastOnlineRef = useRef(isOnline)

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await getDeferredMutationCount())
  }, [])

  const replayQueue = useCallback(async () => {
    if (replayLockRef.current) {
      return { syncedCount: 0, errors: [] as Array<{ id: string; error: string }> }
    }

    replayLockRef.current = true
    setIsReplaying(true)

    try {
      const result = await replayDeferredMutations()
      await refreshPendingCount()

      if (result.syncedCount > 0) {
        invalidateEmailQueries(queryClient)
      }

      return result
    } finally {
      replayLockRef.current = false
      setIsReplaying(false)
    }
  }, [queryClient, refreshPendingCount])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      await refreshPendingCount()
      if (!cancelled && typeof navigator !== 'undefined' && navigator.onLine) {
        const count = await getDeferredMutationCount()
        if (!cancelled && count > 0) {
          await replayQueue()
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [refreshPendingCount, replayQueue])

  useEffect(() => subscribeOfflineQueueChanges(() => {
    void refreshPendingCount()
  }), [refreshPendingCount])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      lastOnlineRef.current = isOnline
      return
    }

    if (!lastOnlineRef.current && isOnline && pendingCount > 0) {
      void replayQueue()
    }

    lastOnlineRef.current = isOnline
  }, [isOnline, pendingCount, replayQueue])

  return {
    pendingCount,
    isReplaying,
    replayQueue,
    refreshPendingCount,
  }
}
