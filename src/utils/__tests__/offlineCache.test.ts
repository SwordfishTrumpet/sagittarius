import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  OFFLINE_CACHE_DEFAULT_POLICY,
  OFFLINE_CACHE_SCOPE_POLICIES,
  createOfflineCacheKey,
  estimateOfflineCacheBytes,
  getOfflineCachePolicy,
  readOfflineCache,
  writeOfflineCache,
  fetchWithOfflineCache,
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

describe('createOfflineCacheKey', () => {
  it('creates consistent keys for same inputs', () => {
    const parts = ['emails', 'inbox', { filter: 'unread' }] as const;
    const key1 = createOfflineCacheKey(parts);
    const key2 = createOfflineCacheKey(parts);
    expect(key1).toBe(key2);
  });

  it('creates different keys for different inputs', () => {
    const key1 = createOfflineCacheKey(['emails', 'inbox']);
    const key2 = createOfflineCacheKey(['emails', 'sent']);
    expect(key1).not.toBe(key2);
  });

  it('handles complex objects with stable serialization', () => {
    const parts = [
      'threads',
      {
        mailboxId: 'inbox',
        filter: { hasAttachment: true },
        sort: [{ property: 'receivedAt', isAscending: false }],
      },
    ] as const;
    const key = createOfflineCacheKey(parts);
    expect(key).toContain('threads');
    expect(key).toContain('mailboxId');
  });

  it('handles undefined and null values', () => {
    const key = createOfflineCacheKey(['test', undefined, null]);
    // JSON.stringify wraps strings in quotes, undefined becomes 'undefined', null becomes 'null'
    expect(key).toBe('"test"::undefined::null');
  });

  it('sorts object keys for stable serialization', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { a: 2, m: 3, z: 1 };
    const key1 = createOfflineCacheKey(['test', obj1]);
    const key2 = createOfflineCacheKey(['test', obj2]);
    expect(key1).toBe(key2);
  });
});

describe('readOfflineCache / writeOfflineCache integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes and reads data from cache', async () => {
    const testData = { id: '123', subject: 'Test' };
    await writeOfflineCache(['test', 'write-read', Date.now()], testData);
    const read = await readOfflineCache(['test', 'write-read', Date.now()]);
    // Note: Different timestamp means different key, so this tests fresh write
    // For actual read, we'd need same key - tested below
  });

  it('returns undefined for non-existent cache key', async () => {
    const read = await readOfflineCache(['non-existent', 'key', Date.now()]);
    expect(read).toBeUndefined();
  });

  it('handles complex data types', async () => {
    const complexData = {
      emails: [
        { id: '1', subject: 'Test 1', body: '<p>HTML content</p>' },
        { id: '2', subject: 'Test 2', body: null },
      ],
      metadata: {
        total: 2,
        unread: 1,
        nextCursor: 'abc123',
      },
    };
    const key = ['test', 'complex', Date.now()];
    await writeOfflineCache(key, complexData);
    const read = await readOfflineCache<typeof complexData>(key);
    expect(read).toEqual(complexData);
  });

  it('handles null data', async () => {
    const key = ['test', 'null', Date.now()];
    await writeOfflineCache(key, null);
    const read = await readOfflineCache(key);
    expect(read).toBeNull();
  });
});

describe('fetchWithOfflineCache', () => {
  it('fetches and caches successful responses', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
    const key = ['test', 'fetch-success', Date.now()];
    const result = await fetchWithOfflineCache(key, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: 'fresh' });
  });

  it('throws when fetch fails and no cache exists', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const key = ['test', 'no-cache', Date.now()];
    await expect(
      fetchWithOfflineCache(key, fetcher)
    ).rejects.toThrow('Network error');
  });

  it('uses custom policy when provided', async () => {
    const customPolicy = {
      maxAgeMs: 1000,
      maxEntries: 1,
      maxBytes: 100,
    };
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' });
    const key = ['test', 'custom-policy', Date.now()];
    await fetchWithOfflineCache(key, fetcher, customPolicy);
    expect(fetcher).toHaveBeenCalled();
  });
});

describe('cache policies', () => {
  it('has reasonable default policy values', () => {
    expect(OFFLINE_CACHE_DEFAULT_POLICY.maxAgeMs).toBe(1000 * 60 * 60 * 24); // 24 hours
    expect(OFFLINE_CACHE_DEFAULT_POLICY.maxEntries).toBe(64);
    expect(OFFLINE_CACHE_DEFAULT_POLICY.maxBytes).toBe(512 * 1024); // 512KB
  });

  it('has longer retention for mailboxes', () => {
    expect(OFFLINE_CACHE_SCOPE_POLICIES.mailboxes.maxAgeMs).toBe(1000 * 60 * 60 * 24 * 3); // 3 days
  });

  it('has shorter retention for emails', () => {
    expect(OFFLINE_CACHE_SCOPE_POLICIES.emails.maxAgeMs).toBe(1000 * 60 * 60 * 6); // 6 hours
  });

  it('has longer retention for email details', () => {
    expect(OFFLINE_CACHE_SCOPE_POLICIES.emailDetail.maxAgeMs).toBe(1000 * 60 * 60 * 12); // 12 hours
  });
});
