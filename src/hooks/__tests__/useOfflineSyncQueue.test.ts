import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOfflineSyncQueue } from '../useOfflineSyncQueue'

const {
  invalidateEmailQueries,
  getDeferredMutationCount,
  replayDeferredMutations,
  subscribeOfflineQueueChanges,
} = vi.hoisted(() => ({
  invalidateEmailQueries: vi.fn(),
  getDeferredMutationCount: vi.fn(),
  replayDeferredMutations: vi.fn(),
  subscribeOfflineQueueChanges: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('../useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}))

vi.mock('../../utils/offlineSyncQueue', () => ({
  getDeferredMutationCount,
  replayDeferredMutations,
  subscribeOfflineQueueChanges,
}))

vi.mock('../jmap/queryCacheUtils', () => ({
  invalidateEmailQueries,
}))

describe('useOfflineSyncQueue', () => {
  beforeEach(() => {
    invalidateEmailQueries.mockReset()
    getDeferredMutationCount.mockReset()
    replayDeferredMutations.mockReset()
    subscribeOfflineQueueChanges.mockReset()

    getDeferredMutationCount.mockResolvedValue(0)
    replayDeferredMutations.mockResolvedValue({ syncedCount: 1, errors: [] })
    subscribeOfflineQueueChanges.mockReturnValue(() => {})
  })

  it('invalidates only mail-related queries after replay', async () => {
    const { result } = renderHook(() => useOfflineSyncQueue())

    await waitFor(() => {
      expect(getDeferredMutationCount).toHaveBeenCalled()
    })

    await act(async () => {
      await result.current.replayQueue()
    })

    expect(invalidateEmailQueries).toHaveBeenCalledTimes(1)
  })
})
