/**
 * Tests for usePushConnection (issue #3): exactly ONE push transport may run
 * at a time — the SSE fallback only starts after WebSocket has given up
 * (terminal circuit breaker), never while WS is still in its retry loop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePushConnection } from '../usePushConnection'

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    hasCapability: vi.fn(),
    getWebSocketUrl: vi.fn(),
    getEventSourceUrl: vi.fn(),
  },
}))

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(),
}))

vi.mock('../useEventSource', () => ({
  useEventSource: vi.fn(),
}))

import { useWebSocket } from '../useWebSocket'
import { useEventSource } from '../useEventSource'
import { jmapClient } from '../../api/jmap'

function makeWs(overrides: Record<string, unknown> = {}) {
  return {
    isConnected: false,
    hasNewMail: false,
    clearNewMail: vi.fn(),
    isTerminal: false,
    retry: vi.fn(),
    ...overrides,
  }
}

function makeEs(overrides: Record<string, unknown> = {}) {
  return {
    isConnected: false,
    hasNewMail: false,
    clearNewMail: vi.fn(),
    isTerminal: false,
    retry: vi.fn(),
    ...overrides,
  }
}

function setupServer({ wsCapability = true, wsUrl = 'wss://mail.example.com/jmap/ws', esUrl = '/jmap/eventsource' }: {
  wsCapability?: boolean
  wsUrl?: string | null
  esUrl?: string | null
} = {}) {
  vi.mocked(jmapClient.hasCapability).mockReturnValue(wsCapability)
  vi.mocked(jmapClient.getWebSocketUrl).mockReturnValue(wsUrl)
  vi.mocked(jmapClient.getEventSourceUrl).mockReturnValue(esUrl)
}

function lastEsEnabled(): boolean | undefined {
  const calls = vi.mocked(useEventSource).mock.calls
  return calls.length > 0 ? calls[calls.length - 1][0] : undefined
}

describe('usePushConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupServer()
  })

  it('does NOT start the SSE fallback while WebSocket is still retrying (single transport)', () => {
    vi.mocked(useWebSocket).mockReturnValue(makeWs({ isConnected: false, isTerminal: false }))
    vi.mocked(useEventSource).mockReturnValue(makeEs())

    renderHook(() => usePushConnection(true))

    expect(useWebSocket).toHaveBeenCalledWith(true)
    expect(lastEsEnabled()).toBe(false)
  })

  it('starts the SSE fallback once WebSocket is terminal', () => {
    vi.mocked(useWebSocket).mockReturnValue(makeWs({ isConnected: false, isTerminal: true }))
    vi.mocked(useEventSource).mockReturnValue(makeEs())

    renderHook(() => usePushConnection(true))

    expect(lastEsEnabled()).toBe(true)
  })

  it('stops the SSE fallback when WebSocket reconnects successfully', () => {
    vi.mocked(useWebSocket).mockReturnValue(makeWs({ isConnected: false, isTerminal: true }))
    vi.mocked(useEventSource).mockReturnValue(makeEs())

    const { rerender } = renderHook(() => usePushConnection(true))
    expect(lastEsEnabled()).toBe(true)

    // WS recovers
    vi.mocked(useWebSocket).mockReturnValue(makeWs({ isConnected: true, isTerminal: false }))
    rerender()
    expect(lastEsEnabled()).toBe(false)
  })

  it('uses SSE directly when WebSocket is unavailable', () => {
    setupServer({ wsCapability: false, wsUrl: null })
    vi.mocked(useWebSocket).mockReturnValue(makeWs())
    vi.mocked(useEventSource).mockReturnValue(makeEs())

    renderHook(() => usePushConnection(true))

    expect(useWebSocket).toHaveBeenCalledWith(false)
    expect(lastEsEnabled()).toBe(true)
  })

  it('reports terminal only when the active transport gave up and nothing is connected', () => {
    // WS terminal, SSE not yet connected → terminal
    vi.mocked(useWebSocket).mockReturnValue(makeWs({ isConnected: false, isTerminal: true }))
    vi.mocked(useEventSource).mockReturnValue(makeEs())
    const first = renderHook(() => usePushConnection(true))
    expect(first.result.current.pushTerminal).toBe(true)

    // SSE connects → push is healthy again via fallback → not terminal
    vi.mocked(useEventSource).mockReturnValue(makeEs({ isConnected: true, isTerminal: false }))
    first.rerender()
    expect(first.result.current.pushTerminal).toBe(false)
  })

  it('retryPush resets both circuit breakers', () => {
    const wsRetry = vi.fn()
    const esRetry = vi.fn()
    vi.mocked(useWebSocket).mockReturnValue(makeWs({ isTerminal: true, retry: wsRetry }))
    vi.mocked(useEventSource).mockReturnValue(makeEs({ retry: esRetry }))

    const { result } = renderHook(() => usePushConnection(true))
    act(() => {
      result.current.retryPush()
    })

    expect(wsRetry).toHaveBeenCalledTimes(1)
    expect(esRetry).toHaveBeenCalledTimes(1)
  })
})
