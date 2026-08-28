/**
 * Shared server-reachability state (issue #5).
 *
 * The offline queue must defer mutations not only when the machine is
 * offline, but also when the machine is online and the JMAP backend is
 * unreachable (502/504, DNS failure, refused connections surfaced by the
 * proxy) — the exact scenario where `navigator.onLine` stays true while the
 * backend is gone. This module is the shared signal: fed by `request()`
 * outcomes and consumed by `runDeferredAwareMutation()` (deferral window)
 * and `useOfflineSyncQueue` (auto-replay on recovery).
 */

export type ServerReachability = 'unknown' | 'reachable' | 'unreachable'

/**
 * Bounded deferral window: mutations failing with server-unreachable errors
 * are queued for at most this long after the backend became unreachable.
 * Past the window, new mutations fail hard so users are not silently
 * queueing forever during a long outage. Any successful request resets the
 * episode.
 */
export const DEFERRAL_WINDOW_MS = 10 * 60 * 1000

let state: ServerReachability = 'unknown'
let unreachableSince: number | null = null
const listeners = new Set<(reachability: ServerReachability) => void>()

function notify() {
  for (const listener of listeners) {
    try {
      listener(state)
    } catch {
      // A listener must never break reachability bookkeeping.
    }
  }
}

export function markServerReachable(): void {
  const wasUnreachable = state === 'unreachable'
  if (state === 'reachable' && !wasUnreachable) return
  state = 'reachable'
  unreachableSince = null
  if (wasUnreachable) notify()
}

export function markServerUnreachable(): void {
  if (state === 'unreachable') return
  state = 'unreachable'
  unreachableSince = Date.now()
  notify()
}

export function getServerReachability(): ServerReachability {
  return state
}

/**
 * True when a server-unreachable failure should be deferred to the offline
 * queue instead of surfacing as a hard error. The first failure seeds the
 * unreachable episode; subsequent failures defer while within the window.
 */
export function shouldDeferMutation(): boolean {
  if (state !== 'unreachable') {
    markServerUnreachable()
    return true
  }
  return Date.now() - (unreachableSince ?? Date.now()) < DEFERRAL_WINDOW_MS
}

export function subscribeServerReachability(listener: (reachability: ServerReachability) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test helper: reset module state between tests. */
export function resetServerReachabilityForTests(): void {
  state = 'unknown'
  unreachableSince = null
  listeners.clear()
}
