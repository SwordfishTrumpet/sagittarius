/**
 * Tests for exported helpers in useEmailMutations.ts:
 * - updateEmailStateFromResponse processes ALL matching method responses
 *   instead of breaking after the first (BUG-2026-051).
 * - trackExplicitUnread / isExplicitlyMarkedUnread feed the auto-mark-read
 *   guard in fetchEmailDetail (BUG-2026-018).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSetState = vi.fn()

vi.mock('../../api/stateManager', () => ({
  stateManager: {
    getState: vi.fn(),
    setState: (type: string, state: string) => mockSetState(type, state),
    clearAll: vi.fn(),
  },
}))

// useEmailMutations also imports tanstack, jmapClient, and the offline queue.
// Only the helpers under test are imported, so provide light mocks for the
// module graph.
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: { getPrimaryAccount: () => 'account-001' },
}))

vi.mock('../../utils/offlineSyncQueue', () => ({
  assertSuccessfulJmapResponse: vi.fn(),
  isDeferredMutationResult: () => false,
  runDeferredAwareMutation: async ({ execute }: { execute: () => unknown }) => execute(),
}))

vi.mock('../../utils/capabilityUtils', () => ({
  chunkForSet: (items: unknown[]) => [items],
}))

import { updateEmailStateFromResponse, trackExplicitUnread, isExplicitlyMarkedUnread } from '../jmap/useEmailMutations'

describe('updateEmailStateFromResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes EVERY matching method response, not just the first (BUG-2026-051)', () => {
    // A single JMAP response can contain Email/get AND Email/set; the state
    // from each must be applied (last wins) rather than stopping at the first.
    const response = {
      methodResponses: [
        ['Email/get', { state: 'state-from-get' }, '0'],
        ['Email/set', { newState: 'state-from-set' }, '1'],
      ],
    }

    updateEmailStateFromResponse(response)

    expect(mockSetState).toHaveBeenCalledTimes(2)
    expect(mockSetState).toHaveBeenNthCalledWith(1, 'Email', 'state-from-get')
    expect(mockSetState).toHaveBeenNthCalledWith(2, 'Email', 'state-from-set')
  })

  it('ignores non-state-bearing method responses', () => {
    const response = {
      methodResponses: [
        ['Email/query', { ids: ['e1'] }, '0'],
        ['Thread/get', { list: [] }, '1'],
      ],
    }

    updateEmailStateFromResponse(response)

    expect(mockSetState).not.toHaveBeenCalled()
  })

  it('handles malformed responses gracefully', () => {
    expect(() => updateEmailStateFromResponse(null)).not.toThrow()
    expect(() => updateEmailStateFromResponse(undefined)).not.toThrow()
    expect(() => updateEmailStateFromResponse('nope')).not.toThrow()
    expect(() => updateEmailStateFromResponse({ methodResponses: 'nope' })).not.toThrow()
  })
})

describe('explicit unread tracking', () => {
  beforeEach(() => {
    // Clear the module-level set by unsnoozing the known ids
    trackExplicitUnread('e-1', false)
    trackExplicitUnread('e-2', false)
    trackExplicitUnread('e-3', false)
  })

  it('marks an email as explicitly unread (BUG-2026-018)', () => {
    expect(isExplicitlyMarkedUnread('e-1')).toBe(false)
    trackExplicitUnread('e-1', true)
    expect(isExplicitlyMarkedUnread('e-1')).toBe(true)
  })

  it('clears the flag when the user marks it read again', () => {
    trackExplicitUnread('e-2', true)
    expect(isExplicitlyMarkedUnread('e-2')).toBe(true)
    trackExplicitUnread('e-2', false)
    expect(isExplicitlyMarkedUnread('e-2')).toBe(false)
  })

  it('tracks multiple emails independently', () => {
    trackExplicitUnread('e-1', true)
    trackExplicitUnread('e-3', true)
    expect(isExplicitlyMarkedUnread('e-1')).toBe(true)
    expect(isExplicitlyMarkedUnread('e-2')).toBe(false)
    expect(isExplicitlyMarkedUnread('e-3')).toBe(true)
  })
})
