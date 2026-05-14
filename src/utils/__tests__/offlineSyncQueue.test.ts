import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  assertSuccessfulJmapResponse,
  enqueueDeferredMutation,
  getDeferredMutationCount,
  listDeferredMutations,
  clearDeferredMutations,
  replayDeferredMutations,
  runDeferredAwareMutation,
  isDeferredMutationResult,
} from '../offlineSyncQueue'

describe('offlineSyncQueue utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear in-memory state
    clearDeferredMutations()
  })

  describe('assertSuccessfulJmapResponse', () => {
    it('passes for successful response with no errors', () => {
      const response = {
        methodResponses: [
          ['Email/set', { accountId: 'a1', newState: 's1' }, '0'],
        ],
      }
      expect(() => assertSuccessfulJmapResponse(response)).not.toThrow()
    })

    it('throws on method-level error response', () => {
      const response = {
        methodResponses: [
          ['error', { type: 'serverError', description: 'Something failed' }, '0'],
        ],
      }
      expect(() => assertSuccessfulJmapResponse(response)).toThrow('Something failed')
    })

    it('throws on notCreated errors', () => {
      const response = {
        methodResponses: [
          ['Email/set', { accountId: 'a1', notCreated: { 'e1': { type: 'invalidEmail', description: 'Bad address' } } }, '0'],
        ],
      }
      expect(() => assertSuccessfulJmapResponse(response)).toThrow('Bad address')
    })

    it('throws on notUpdated errors', () => {
      const response = {
        methodResponses: [
          ['Email/set', { accountId: 'a1', notUpdated: { 'e1': { type: 'notFound', description: 'Email not found' } } }, '0'],
        ],
      }
      expect(() => assertSuccessfulJmapResponse(response)).toThrow('Email not found')
    })

    it('throws on notDestroyed errors', () => {
      const response = {
        methodResponses: [
          ['Email/set', { accountId: 'a1', notDestroyed: { 'e1': { type: 'notFound', description: 'Cannot delete' } } }, '0'],
        ],
      }
      expect(() => assertSuccessfulJmapResponse(response)).toThrow('Cannot delete')
    })

    it('throws generic message when no description available', () => {
      const response = {
        methodResponses: [
          ['error', { type: 'unknown' }, '0'],
        ],
      }
      expect(() => assertSuccessfulJmapResponse(response)).toThrow('unknown')
    })

    it('handles empty or malformed response gracefully', () => {
      expect(() => assertSuccessfulJmapResponse(null)).not.toThrow()
      expect(() => assertSuccessfulJmapResponse(undefined)).not.toThrow()
      expect(() => assertSuccessfulJmapResponse({})).not.toThrow()
      expect(() => assertSuccessfulJmapResponse('string')).not.toThrow()
    })
  })

  describe('enqueueDeferredMutation', () => {
    it('returns a DeferredMutationResult', async () => {
      const result = await enqueueDeferredMutation({
        accountId: 'acc-1',
        operation: 'testOp',
        payload: { description: 'Test', requests: [] },
      })

      expect(result).toHaveProperty('deferred', true)
      expect(result).toHaveProperty('mutationId')
      expect(result).toHaveProperty('operation', 'testOp')
      expect(result).toHaveProperty('queuedAt')
    })
  })

  describe('getDeferredMutationCount', () => {
    it('returns 0 when empty', async () => {
      const count = await getDeferredMutationCount()
      expect(count).toBe(0)
    })

    it('returns count after enqueueing', async () => {
      await enqueueDeferredMutation({
        accountId: 'acc-1',
        operation: 'op1',
        payload: { description: 'First', requests: [] },
      })

      const count = await getDeferredMutationCount()
      expect(count).toBe(1)
    })
  })

  describe('listDeferredMutations', () => {
    it('returns empty array initially', async () => {
      const list = await listDeferredMutations()
      expect(list).toEqual([])
    })

    it('returns queued mutations', async () => {
      await enqueueDeferredMutation({
        accountId: 'acc-1',
        operation: 'op1',
        payload: { description: 'First', requests: [] },
      })

      const list = await listDeferredMutations()
      expect(list).toHaveLength(1)
      expect(list[0].operation).toBe('op1')
    })
  })

  describe('clearDeferredMutations', () => {
    it('removes all queued mutations', async () => {
      await enqueueDeferredMutation({
        accountId: 'acc-1',
        operation: 'op1',
        payload: { description: 'First', requests: [] },
      })

      await clearDeferredMutations()
      const count = await getDeferredMutationCount()
      expect(count).toBe(0)
    })
  })

  describe('isDeferredMutationResult', () => {
    it('returns true for deferred result', () => {
      expect(isDeferredMutationResult({ deferred: true, mutationId: 'x', operation: 'o', queuedAt: 1 })).toBe(true)
    })

    it('returns false for non-deferred result', () => {
      expect(isDeferredMutationResult({ data: 'hello' })).toBe(false)
    })

    it('returns false for null and primitives', () => {
      expect(isDeferredMutationResult(null)).toBe(false)
      expect(isDeferredMutationResult(undefined)).toBe(false)
      expect(isDeferredMutationResult('string')).toBe(false)
    })
  })

  describe('runDeferredAwareMutation', () => {
    const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')

    afterEach(() => {
      if (originalOnLine) {
        Object.defineProperty(navigator, 'onLine', originalOnLine)
      }
    })

    it('executes directly when online', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

      const execute = vi.fn().mockResolvedValue('success')
      const result = await runDeferredAwareMutation({
        accountId: 'acc-1',
        operation: 'test',
        payload: { description: 'Test', requests: [] },
        execute,
      })

      expect(execute).toHaveBeenCalledTimes(1)
      expect(result).toBe('success')
    })

    it('enqueues when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      const execute = vi.fn().mockResolvedValue('success')
      const result = await runDeferredAwareMutation({
        accountId: 'acc-1',
        operation: 'test',
        payload: { description: 'Test', requests: [] },
        execute,
      })

      expect(execute).not.toHaveBeenCalled()
      expect(isDeferredMutationResult(result)).toBe(true)
    })

    it('throws when offline and no accountId', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      const execute = vi.fn()
      await expect(
        runDeferredAwareMutation({
          accountId: null,
          operation: 'test',
          payload: { description: 'Test', requests: [] },
          execute,
        }),
      ).rejects.toThrow('No account available')
    })
  })
})
