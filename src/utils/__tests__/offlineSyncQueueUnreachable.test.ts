/**
 * Unreachable-backend deferral tests (issue #5).
 *
 * When the machine is online but the JMAP backend is unreachable (proxy
 * 502/504, DNS failure, connection refused), sends and mailbox mutations
 * must be queued to the offline pipeline and replayed when the backend
 * recovers — not hard-failed.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ServerUnreachableError, AuthError } from '../jmapErrors'

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    request: vi.fn(),
  },
}))

async function loadQueueModule() {
  vi.resetModules()
  const mod = await import('../offlineSyncQueue')
  const { jmapClient } = await import('../../api/jmap')
  const { resetServerReachabilityForTests } = await import('../serverReachability')
  return {
    ...mod,
    jmapClient: jmapClient as unknown as { request: ReturnType<typeof vi.fn> },
    resetServerReachabilityForTests,
  }
}

const SEND_PAYLOAD = {
  description: 'Send message from alice@example.com',
  requests: [
    ['Email/set', {
      accountId: 'acc-1',
      create: {
        'draft-1': {
          subject: 'Quarterly update',
          to: [{ email: 'bob@example.com' }],
          from: [{ name: null, email: 'alice@example.com' }],
          bodyValues: { body1: { value: '<p>Draft body that must survive the outage</p>', isTruncated: false } },
          mailboxIds: { 'mb-drafts': true },
          keywords: { '$draft': true },
        },
      },
    }, '0'],
    ['EmailSubmission/set', {
      accountId: 'acc-1',
      create: { 'send-1': { emailId: '#draft-1', identityId: 'id-1' } },
    }, '1'],
  ],
} as const

// Runtime-typed copy (readonly `as const` tuples are not assignable to the
// mutable OfflineJmapRequest[] payload type).
const SEND_PAYLOAD_RUNTIME = JSON.parse(JSON.stringify(SEND_PAYLOAD)) as { description: string; requests: Array<[string, Record<string, unknown>, string]> }

describe('runDeferredAwareMutation — unreachable backend (issue #5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('defers a send when the backend is unreachable but the machine is online', async () => {
    const { runDeferredAwareMutation, isDeferredMutationResult, getDeferredMutationCount, clearDeferredMutations, resetServerReachabilityForTests } = await loadQueueModule()
    await clearDeferredMutations()
    resetServerReachabilityForTests()

    const execute = vi.fn().mockRejectedValue(new ServerUnreachableError('Server unreachable (HTTP 502)'))
    const result = await runDeferredAwareMutation({
      accountId: 'acc-1',
      operation: 'composeSend',
      payload: SEND_PAYLOAD_RUNTIME,
      execute,
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(isDeferredMutationResult(result)).toBe(true)
    expect(await getDeferredMutationCount()).toBe(1)
  })

  it('replays the queued send with the original draft content when the backend recovers', async () => {
    const { runDeferredAwareMutation, isDeferredMutationResult, replayDeferredMutations, getDeferredMutationCount, clearDeferredMutations, resetServerReachabilityForTests, jmapClient } = await loadQueueModule()
    await clearDeferredMutations()
    resetServerReachabilityForTests()

    // Send fails with 502 → deferred
    const execute = vi.fn().mockRejectedValue(new ServerUnreachableError('Server unreachable (HTTP 502)'))
    const result = await runDeferredAwareMutation({
      accountId: 'acc-1',
      operation: 'composeSend',
      payload: SEND_PAYLOAD_RUNTIME,
      execute,
    })
    expect(isDeferredMutationResult(result)).toBe(true)

    // Backend recovers: the replay request succeeds.
    ;(jmapClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      methodResponses: [
        ['Email/set', { accountId: 'acc-1', created: { 'draft-1': { id: 'email-9' } }, newState: 's2' }, '0'],
        ['EmailSubmission/set', { accountId: 'acc-1', created: { 'send-1': { id: 'sub-1' } }, newState: 's3' }, '1'],
      ],
    })

    const replayResult = await replayDeferredMutations()
    expect(replayResult.syncedCount).toBe(1)
    expect(await getDeferredMutationCount()).toBe(0)

    // The replayed request carried the ORIGINAL draft content (no data loss).
    const replayedRequests = (jmapClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<[string, Record<string, unknown>, string]>
    const emailSet = replayedRequests.find(([method]) => method === 'Email/set')?.[1]
    const draftCreate = (emailSet?.create as Record<string, Record<string, unknown>>)?.['draft-1']
    expect((draftCreate?.subject as string | undefined) ?? '').toContain('Quarterly update')
    expect(JSON.stringify(draftCreate?.bodyValues ?? {})).toContain('Draft body that must survive the outage')
    expect((draftCreate?.to as Array<{ email: string }>)?.[0]?.email).toBe('bob@example.com')
  })

  it('stops deferring past the bounded window and surfaces the error', async () => {
    const { runDeferredAwareMutation, isDeferredMutationResult, getDeferredMutationCount, clearDeferredMutations, resetServerReachabilityForTests } = await loadQueueModule()
    await clearDeferredMutations()
    resetServerReachabilityForTests()

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const execute1 = vi.fn().mockRejectedValue(new ServerUnreachableError('Server unreachable'))
    const first = await runDeferredAwareMutation({
      accountId: 'acc-1',
      operation: 'composeSend',
      payload: SEND_PAYLOAD_RUNTIME,
      execute: execute1,
    })
    expect(isDeferredMutationResult(first)).toBe(true)

    // 11 minutes later the backend is still down: the window has closed.
    nowSpy.mockReturnValue(1_000_000 + 11 * 60 * 1000)
    const execute2 = vi.fn().mockRejectedValue(new ServerUnreachableError('Server unreachable'))
    const second = await runDeferredAwareMutation({
      accountId: 'acc-1',
      operation: 'composeSend',
      payload: SEND_PAYLOAD_RUNTIME,
      execute: execute2,
    }).catch((e: unknown) => e)

    expect(second).toBeInstanceOf(ServerUnreachableError)
    expect(await getDeferredMutationCount()).toBe(1) // only the in-window one queued

    nowSpy.mockRestore()
  })

  it('opens a new deferral episode after a successful mutation (reachability resets)', async () => {
    const { runDeferredAwareMutation, isDeferredMutationResult, clearDeferredMutations, resetServerReachabilityForTests } = await loadQueueModule()
    await clearDeferredMutations()
    resetServerReachabilityForTests()

    const fail = vi.fn().mockRejectedValue(new ServerUnreachableError('Server unreachable'))
    const ok = vi.fn().mockResolvedValue('success')

    const first = await runDeferredAwareMutation({ accountId: 'acc-1', operation: 'op', payload: SEND_PAYLOAD_RUNTIME, execute: fail })
    expect(isDeferredMutationResult(first)).toBe(true)

    // A successful mutation marks the backend reachable again.
    await expect(runDeferredAwareMutation({ accountId: 'acc-1', operation: 'op', payload: SEND_PAYLOAD_RUNTIME, execute: ok })).resolves.toBe('success')

    // Next unreachable failure starts a fresh episode → deferred again.
    const third = await runDeferredAwareMutation({ accountId: 'acc-1', operation: 'op', payload: SEND_PAYLOAD_RUNTIME, execute: fail })
    expect(isDeferredMutationResult(third)).toBe(true)
  })

  it('still hard-fails non-unreachable errors (auth/protocol) without queueing', async () => {
    const { runDeferredAwareMutation, getDeferredMutationCount, clearDeferredMutations, resetServerReachabilityForTests } = await loadQueueModule()
    await clearDeferredMutations()
    resetServerReachabilityForTests()

    const authFail = vi.fn().mockRejectedValue(new AuthError('Session expired'))
    await expect(
      runDeferredAwareMutation({ accountId: 'acc-1', operation: 'op', payload: SEND_PAYLOAD_RUNTIME, execute: authFail }),
    ).rejects.toBeInstanceOf(AuthError)

    const plainFail = vi.fn().mockRejectedValue(new Error('JMAP request failed: 500'))
    await expect(
      runDeferredAwareMutation({ accountId: 'acc-1', operation: 'op', payload: SEND_PAYLOAD_RUNTIME, execute: plainFail }),
    ).rejects.toThrow('JMAP request failed: 500')

    expect(await getDeferredMutationCount()).toBe(0)
  })
})
