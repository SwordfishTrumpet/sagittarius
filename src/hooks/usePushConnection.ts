import { useCallback, useEffect, useState } from 'react'
import { jmapClient } from '../api/jmap'
import { useEventSource } from './useEventSource'
import { useWebSocket } from './useWebSocket'

interface UsePushConnectionResult {
  pushEnabled: boolean
  pushConnected: boolean
  /** True when the active push transport tripped its circuit breaker (server unreachable). */
  pushTerminal: boolean
  /** Reset the circuit breaker(s) and reconnect the preferred transport now. */
  retryPush: () => void
  hasNewMail: boolean
  clearNewMail: () => void
}

export function usePushConnection(hasSession: boolean): UsePushConnectionResult {
  const prefersWebSocketPush = hasSession
    && jmapClient.hasCapability('urn:ietf:params:jmap:websocket')
    && !!jmapClient.getWebSocketUrl()
  const hasEventSourcePush = hasSession && !!jmapClient.getEventSourceUrl()

  const wsPush = useWebSocket(prefersWebSocketPush)
  // SSE fallback: enabled only when WebSocket is unavailable OR has given up
  // (terminal) — never while WS is still in its retry loop, so only ONE push
  // transport runs at a time against a dead backend (issue #3).
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

    if (wsPush.isTerminal) {
      // WS gave up (unreachable-class) — fall back to SSE.
      setUseEventSourceFallback(true)
      return
    }

    // WS still connecting/retrying — do NOT start the SSE fallback in
    // parallel (single transport at a time).
    setUseEventSourceFallback(false)
  }, [hasEventSourcePush, prefersWebSocketPush, wsPush.isConnected, wsPush.isTerminal])

  const esPush = useEventSource(hasEventSourcePush && (!prefersWebSocketPush || useEventSourceFallback))

  const clearNewMail = useCallback(() => {
    wsPush.clearNewMail()
    esPush.clearNewMail()
  }, [])

  const retryPush = useCallback(() => {
    // Reset both circuit breakers; the effects above immediately reconcile
    // to a single transport (WS preferred, SSE only when WS is terminal).
    wsPush.retry()
    esPush.retry()
  }, [wsPush.retry, esPush.retry])

  // Terminal = the ACTIVE transport gave up and nothing is connected. A
  // working SSE fallback clears WS-terminal (push is healthy via SSE).
  const activeWsTerminal = prefersWebSocketPush && wsPush.isTerminal && !esPush.isConnected
  const activeEsTerminal = (!prefersWebSocketPush || useEventSourceFallback)
    && esPush.isTerminal && !esPush.isConnected

  return {
    pushEnabled: prefersWebSocketPush || hasEventSourcePush,
    pushConnected: wsPush.isConnected || esPush.isConnected,
    pushTerminal: activeWsTerminal || activeEsTerminal,
    retryPush,
    hasNewMail: wsPush.hasNewMail || esPush.hasNewMail,
    clearNewMail,
  }
}
