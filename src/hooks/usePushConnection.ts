import { useCallback, useEffect, useState } from 'react'
import { jmapClient } from '../api/jmap'
import { useEventSource } from './useEventSource'
import { useWebSocket } from './useWebSocket'

const WEBSOCKET_FALLBACK_DELAY_MS = 3_000

interface UsePushConnectionResult {
  pushEnabled: boolean
  pushConnected: boolean
  hasNewMail: boolean
  clearNewMail: () => void
}

export function usePushConnection(hasSession: boolean): UsePushConnectionResult {
  const prefersWebSocketPush = hasSession
    && jmapClient.hasCapability('urn:ietf:params:jmap:websocket')
    && !!jmapClient.getWebSocketUrl()
  const hasEventSourcePush = hasSession && !!jmapClient.getEventSourceUrl()

  const wsPush = useWebSocket(prefersWebSocketPush)
  const [useEventSourceFallback, setUseEventSourceFallback] = useState(
    () => hasEventSourcePush && !prefersWebSocketPush,
  )

  useEffect(() => {
    if (!hasEventSourcePush) {
      setUseEventSourceFallback(false)
      return
    }

    if (!prefersWebSocketPush) {
      setUseEventSourceFallback(true)
      return
    }

    if (wsPush.isConnected) {
      setUseEventSourceFallback(false)
      return
    }

    const timer = window.setTimeout(() => {
      setUseEventSourceFallback(true)
    }, WEBSOCKET_FALLBACK_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [hasEventSourcePush, prefersWebSocketPush, wsPush.isConnected])

  const esPush = useEventSource(hasEventSourcePush && (!prefersWebSocketPush || useEventSourceFallback))

  const clearNewMail = useCallback(() => {
    wsPush.clearNewMail()
    esPush.clearNewMail()
  }, [])

  return {
    pushEnabled: prefersWebSocketPush || hasEventSourcePush,
    pushConnected: wsPush.isConnected || esPush.isConnected,
    hasNewMail: wsPush.hasNewMail || esPush.hasNewMail,
    clearNewMail,
  }
}
