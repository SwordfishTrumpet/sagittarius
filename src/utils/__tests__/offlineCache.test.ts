import { describe, expect, it } from 'vitest'
import {
  OFFLINE_CACHE_DEFAULT_POLICY,
  OFFLINE_CACHE_SCOPE_POLICIES,
  estimateOfflineCacheBytes,
  getOfflineCachePolicy,
  selectOfflineCacheVictims,
  type OfflineCacheRecord,
} from '../offlineCache'

describe('offline cache policy', () => {
  it('uses tighter limits for larger mailbox data', () => {
    expect(getOfflineCachePolicy(['mailboxes'])).toEqual(OFFLINE_CACHE_SCOPE_POLICIES.mailboxes)
    expect(getOfflineCachePolicy(['emails'])).toEqual(OFFLINE_CACHE_SCOPE_POLICIES.emails)
    expect(getOfflineCachePolicy(['unknown'])).toEqual(OFFLINE_CACHE_DEFAULT_POLICY)
  })

  it('evicts expired and least-recently-used records first', () => {
    const records: OfflineCacheRecord[] = [
      {
        cacheKey: 'expired',
        scope: 'emails',
        data: null,
        updatedAt: 10,
        lastAccessedAt: 10,
        expiresAt: 900,
        approxBytes: 10,
      },
      {
        cacheKey: 'oldest',
        scope: 'emails',
        data: null,
        updatedAt: 20,
        lastAccessedAt: 20,
        expiresAt: 2_000,
        approxBytes: 10,
      },
      {
        cacheKey: 'newest',
        scope: 'emails',
        data: null,
        updatedAt: 30,
        lastAccessedAt: 30,
        expiresAt: 2_000,
        approxBytes: 10,
      },
    ]

    expect(selectOfflineCacheVictims(records, { maxAgeMs: 1_000, maxEntries: 1, maxBytes: 10 }, 1_000)).toEqual([
      'expired',
      'oldest',
    ])
  })

  it('evicts oversized payloads when the byte budget is exceeded', () => {
    const records: OfflineCacheRecord[] = [
      {
        cacheKey: 'small',
        scope: 'emailDetail',
        data: null,
        updatedAt: 10,
        lastAccessedAt: 10,
        expiresAt: 2_000,
        approxBytes: 100,
      },
      {
        cacheKey: 'large',
        scope: 'emailDetail',
        data: null,
        updatedAt: 20,
        lastAccessedAt: 20,
        expiresAt: 2_000,
        approxBytes: 900,
      },
    ]

    expect(selectOfflineCacheVictims(records, { maxAgeMs: 1_000, maxEntries: 10, maxBytes: 500 }, 1_000)).toEqual([
      'small',
      'large',
    ])
  })

  it('estimates payload size for JSON cache entries', () => {
    expect(estimateOfflineCacheBytes({ subject: 'Hello', flags: ['seen'] })).toBeGreaterThan(0)
  })
})
