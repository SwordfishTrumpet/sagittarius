import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { eventSourceManager } from '../eventSource'
import { stateManager } from '../stateManager'

type MockHandler = (event: MessageEvent) => void

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  readyState = 0
  onopen: ((event?: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event?: Event) => void) | null = null
  listeners = new Map<string, MockHandler[]>()

  constructor(url: string | URL) {
    this.url = String(url)
    MockEventSource.instances.push(this)
  }

  addEventListener = vi.fn((type: string, handler: MockHandler) => {
    const handlers = this.listeners.get(type) || []
    handlers.push(handler)
    this.listeners.set(type, handlers)
  })

  emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent

    if (type === 'message') {
      this.onmessage?.(event)
      return
    }

    for (const handler of this.listeners.get(type) || []) {
      handler(event)
    }
  }

  close = vi.fn(() => {
    this.readyState = 2
  })
}

describe('eventSourceManager', () => {
  const originalEventSource = globalThis.EventSource

  beforeEach(() => {
    MockEventSource.instances = []
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource
    stateManager.clearAll()
  })

  afterEach(() => {
    eventSourceManager.disconnect()
    stateManager.clearAll()
    globalThis.EventSource = originalEventSource
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('URL-encodes access_token so plus signs survive proxy parsing', () => {
    const qc = new QueryClient()

    eventSourceManager.connect(
      '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
      'abc+123/==',
      qc,
    )

    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toContain('types=*')
    expect(MockEventSource.instances[0].url).toContain('closeafter=no')
    expect(MockEventSource.instances[0].url).toContain('ping=30')
    expect(MockEventSource.instances[0].url).toContain('access_token=abc%2B123%2F%3D%3D')
  })

  it('handles named state events and invalidates matching queries', () => {
    const qc = { invalidateQueries: vi.fn() } as unknown as QueryClient

    eventSourceManager.connect(
      '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
      'token',
      qc,
    )

    MockEventSource.instances[0].emit('state', {
      changed: { a1: { Mailbox: 'mailbox-state-1' } },
    })

    expect((qc.invalidateQueries as any).mock.calls).toEqual([
      [{ queryKey: ['mailboxes'] }],
    ])
  })

  it('suppresses new-mail listeners for local Email mutations', () => {
    const qc = { invalidateQueries: vi.fn() } as unknown as QueryClient
    const listener = vi.fn()

    eventSourceManager.connect(
      '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
      'token',
      qc,
    )
    eventSourceManager.onNewMail(listener)
    eventSourceManager.suppressNotification()

    MockEventSource.instances[0].emit('state', {
      changed: { a1: { Email: 'email-state-1' } },
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('always fires new-mail listeners for EmailDelivery changes', () => {
    const qc = { invalidateQueries: vi.fn() } as unknown as QueryClient
    const listener = vi.fn()

    eventSourceManager.connect(
      '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
      'token',
      qc,
    )
    eventSourceManager.onNewMail(listener)
    eventSourceManager.suppressNotification()

    MockEventSource.instances[0].emit('state', {
      changed: { a1: { EmailDelivery: 'delivery-state-1' } },
    })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('skips invalidation when the state value did not change', () => {
    const qc = { invalidateQueries: vi.fn() } as unknown as QueryClient
    stateManager.setState('Email', 'same-state')

    eventSourceManager.connect(
      '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
      'token',
      qc,
    )

    MockEventSource.instances[0].emit('state', {
      changed: { a1: { Email: 'same-state' } },
    })

    expect(qc.invalidateQueries).not.toHaveBeenCalled()
  })

  it('reconnects after an EventSource error', () => {
    vi.useFakeTimers()
    const qc = { invalidateQueries: vi.fn() } as unknown as QueryClient

    eventSourceManager.connect(
      '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
      'token',
      qc,
    )

    expect(MockEventSource.instances).toHaveLength(1)
    MockEventSource.instances[0].onerror?.(new Event('error'))

    expect(MockEventSource.instances[0].close).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)

    expect(MockEventSource.instances).toHaveLength(2)
  })

  it('reconnects even when first connection attempt fails (regression test for attempts===0 bug)', () => {
    vi.useFakeTimers()
    const qc = { invalidateQueries: vi.fn() } as unknown as QueryClient

    // First connection attempt
    eventSourceManager.connect(
      '/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
      'token',
      qc,
    )

    expect(MockEventSource.instances).toHaveLength(1)
    const firstInstance = MockEventSource.instances[0]

    // Simulate first connection failure (e.g., 401 auth error on first attempt)
    // This previously would block ALL reconnection attempts due to attempts===0 check
    firstInstance.onerror?.(new Event('error'))

    // Should still reconnect even though this was the first attempt (attempts was 0)
    vi.advanceTimersByTime(1000)
    expect(MockEventSource.instances).toHaveLength(2)

    // Verify exponential backoff: second reconnect should take 2000ms
    const secondInstance = MockEventSource.instances[1]
    secondInstance.onerror?.(new Event('error'))

    vi.advanceTimersByTime(2000)
    expect(MockEventSource.instances).toHaveLength(3)
  })
})
