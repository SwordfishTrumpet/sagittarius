import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOfflineSyncQueue } from '../useOfflineSyncQueue'

const {
  invalidateQueries,
  getDeferredMutationCount,
  replayDeferredMutations,
  subscribeOfflineQueueChanges,
} = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  getDeferredMutationCount: vi.fn(),
  replayDeferredMutations: vi.fn(),
  subscribeOfflineQueueChanges: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries,
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

describe('useOfflineSyncQueue', () => {
  beforeEach(() => {
    invalidateQueries.mockReset()
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

    expect(invalidateQueries).toHaveBeenCalledTimes(4)
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['threads'] })
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['emails'] })
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['emailDetail'] })
    expect(invalidateQueries).toHaveBeenNthCalledWith(4, { queryKey: ['mailboxes'] })
  })
})
