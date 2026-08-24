/**
 * Replay-specific offline sync queue tests (BUG-2026-020, BUG-2026-022).
 *
 * Uses dynamic imports + vi.resetModules() so the module-level replayPromise
 * and in-memory mutation store are fresh for each test.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// jmapClient.request is the only external call the replay path makes;
// stateManager is kept real so setState/getState behave normally.
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    request: vi.fn(),
  },
}))

type ReplayResult = { syncedCount: number; errors: Array<{ id: string; error: string }> }

async function loadQueueModule() {
  vi.resetModules()
  const mod = await import('../offlineSyncQueue')
  const { stateManager } = await import('../../api/stateManager')
  const { jmapClient } = await import('../../api/jmap')
  return { ...mod, stateManager, jmapClient: jmapClient as unknown as { request: ReturnType<typeof vi.fn> } }
}

describe('replayDeferredMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('refreshes stale ifInState from current Email state before replaying (BUG-2026-020)', async () => {
    const { enqueueDeferredMutation, replayDeferredMutations, clearDeferredMutations, stateManager, jmapClient } = await loadQueueModule()
    await clearDeferredMutations()

    // Queue a mutation whose ifInState was captured at mutation time (stale)
    await enqueueDeferredMutation({
      accountId: 'acc-1',
      operation: 'updateKeywords',
      payload: {
        description: 'Toggle keywords',
        requests: [
          ['Email/set', { accountId: 'acc-1', ifInState: 'stale-token', update: { e1: { 'keywords/$seen': true } } }, '0'],
        ],
      },
    })

    // Server moved on: current state differs from the captured token
    stateManager.setState('Email', 'fresh-token')

    ;(jmapClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      methodResponses: [
        ['Email/set', { accountId: 'acc-1', newState: 'fresh-token-2' }, '0'],
      ],
    })

    const result: ReplayResult = await replayDeferredMutations()
    expect(result.syncedCount).toBe(1)

    const [method, args] = (jmapClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(method).toBe('Email/set')
    expect(args.ifInState).toBe('fresh-token')
  })

  it('replays non-Email/set requests unchanged (no ifInState injected)', async () => {
    const { enqueueDeferredMutation, replayDeferredMutations, clearDeferredMutations, stateManager, jmapClient } = await loadQueueModule()
    await clearDeferredMutations()

    await enqueueDeferredMutation({
      accountId: 'acc-1',
      operation: 'createMailbox',
      payload: {
        description: 'Create mailbox',
        requests: [
          ['Mailbox/set', { accountId: 'acc-1', create: { 'm1': { name: 'Projects' } } }, '0'],
        ],
      },
    })

    stateManager.setState('Email', 'fresh-token')

    ;(jmapClient.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      methodResponses: [
        ['Mailbox/set', { accountId: 'acc-1', newState: 'mb-state' }, '0'],
      ],
    })

    const result: ReplayResult = await replayDeferredMutations()
    expect(result.syncedCount).toBe(1)

    const [method, args] = (jmapClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(method).toBe('Mailbox/set')
    expect(args.ifInState).toBeUndefined()
  })

  it('concurrent callers await the same in-flight replay instead of double-processing (BUG-2026-022)', async () => {
    const { enqueueDeferredMutation, replayDeferredMutations, clearDeferredMutations, jmapClient } = await loadQueueModule()
    await clearDeferredMutations()

    await enqueueDeferredMutation({
      accountId: 'acc-1',
      operation: 'updateKeywords',
      payload: {
        description: 'Toggle keywords',
        requests: [
          ['Email/set', { accountId: 'acc-1', update: { e1: { 'keywords/$seen': true } } }, '0'],
        ],
      },
    })

    // Hold the request open so we can observe concurrency
    let resolveRequest: (value: unknown) => void
    const pending = new Promise((resolve) => { resolveRequest = resolve })
    ;(jmapClient.request as ReturnType<typeof vi.fn>).mockReturnValue(pending)

    const first = replayDeferredMutations()
    const second = replayDeferredMutations()

    resolveRequest!({ methodResponses: [['Email/set', { accountId: 'acc-1', newState: 's' }, '0']] })

    const [r1, r2] = await Promise.all([first, second]) as [ReplayResult, ReplayResult]

    // Both callers saw the SAME replay result (shared in-flight promise)
    expect(r1.syncedCount).toBe(1)
    expect(r2.syncedCount).toBe(1)
    expect(jmapClient.request).toHaveBeenCalledTimes(1)
  })

  it('stops retrying a permanently failing mutation after MAX_ATTEMPTS (BUG-2026-059)', async () => {
    const {
      enqueueDeferredMutation,
      replayDeferredMutations,
      clearDeferredMutations,
      listDeferredMutations,
      getFailedMutationCount,
      MAX_ATTEMPTS,
      jmapClient,
    } = await loadQueueModule()
    await clearDeferredMutations()

    await enqueueDeferredMutation({
      accountId: 'acc-1',
      operation: 'updateKeywords',
      payload: {
        description: 'Fails forever',
        requests: [
          ['Email/set', { accountId: 'acc-1', update: { gone: { mailboxIds: {} } } }, '0'],
        ],
      },
    })

    ;(jmapClient.request as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('serverNotFound'))

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await replayDeferredMutations()
    }

    // Record is now terminal: failedAt set, still visible via the list
    const records = await listDeferredMutations()
    expect(records).toHaveLength(1)
    expect(records[0].attemptCount).toBe(MAX_ATTEMPTS)
    expect(records[0].failedAt).toBeTruthy()
    expect(await getFailedMutationCount()).toBe(1)

    // A further reconnect/bootstrap replay does NOT hit the server again
    const callsBefore = (jmapClient.request as ReturnType<typeof vi.fn>).mock.calls.length
    const result = await replayDeferredMutations()
    expect(result.syncedCount).toBe(0)
    expect((jmapClient.request as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)
  })
})
