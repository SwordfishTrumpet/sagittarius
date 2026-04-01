import Dexie, { type Table } from 'dexie'

export type OfflineCachePolicy = {
  maxAgeMs: number
  maxEntries: number
  maxBytes: number
}

export type OfflineCacheRecord = {
  cacheKey: string
  scope: string
  data: unknown
  updatedAt: number
  lastAccessedAt: number
  expiresAt: number
  approxBytes: number
}

type OfflineCacheRecordInput = Pick<OfflineCacheRecord, 'cacheKey' | 'scope' | 'data' | 'updatedAt' | 'lastAccessedAt' | 'expiresAt' | 'approxBytes'>

export const OFFLINE_CACHE_DEFAULT_POLICY: OfflineCachePolicy = {
  maxAgeMs: 1000 * 60 * 60 * 24,
  maxEntries: 64,
  maxBytes: 512 * 1024,
}

export const OFFLINE_CACHE_SCOPE_POLICIES: Record<string, OfflineCachePolicy> = {
  mailboxes: {
    maxAgeMs: 1000 * 60 * 60 * 24 * 3,
    maxEntries: 8,
    maxBytes: 128 * 1024,
  },
  identities: {
    maxAgeMs: 1000 * 60 * 60 * 24 * 3,
    maxEntries: 8,
    maxBytes: 128 * 1024,
  },
  emails: {
    maxAgeMs: 1000 * 60 * 60 * 6,
    maxEntries: 24,
    maxBytes: 768 * 1024,
  },
  threads: {
    maxAgeMs: 1000 * 60 * 60 * 6,
    maxEntries: 24,
    maxBytes: 768 * 1024,
  },
  emailDetail: {
    maxAgeMs: 1000 * 60 * 60 * 12,
    maxEntries: 32,
    maxBytes: 1024 * 1024,
  },
  emailWithBody: {
    maxAgeMs: 1000 * 60 * 60 * 12,
    maxEntries: 16,
    maxBytes: 1024 * 1024,
  },
}

class OfflineCacheDB extends Dexie {
  entries!: Table<OfflineCacheRecord, string>

  constructor() {
    super('sagittarius-offline-cache')
    this.version(2).stores({
      entries: '&cacheKey, scope, updatedAt, lastAccessedAt, expiresAt',
    })
  }
}

const inMemoryCache = new Map<string, OfflineCacheRecord>()
const supportsIndexedDB = typeof indexedDB !== 'undefined'
let dbPromise: Promise<OfflineCacheDB | null> | null = null
let cleanupQueue: Promise<void> = Promise.resolve()

function getDb() {
  if (!supportsIndexedDB) return Promise.resolve(null)
  if (!dbPromise) {
    dbPromise = Promise.resolve(new OfflineCacheDB())
  }
  return dbPromise
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  return JSON.stringify(value, (_key, currentValue) => {
    if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
      return currentValue
    }

    return Object.keys(currentValue as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (currentValue as Record<string, unknown>)[key]
        return acc
      }, {})
  }) ?? 'undefined'
}

export function createOfflineCacheKey(parts: readonly unknown[]) {
  return parts.map(part => stableSerialize(part)).join('::')
}

function getCacheScope(parts: readonly unknown[]) {
  const [scope] = parts
  return typeof scope === 'string' && scope.length > 0 ? scope : 'default'
}

export function getOfflineCachePolicy(parts: readonly unknown[]): OfflineCachePolicy {
  return OFFLINE_CACHE_SCOPE_POLICIES[getCacheScope(parts)] ?? OFFLINE_CACHE_DEFAULT_POLICY
}

export function estimateOfflineCacheBytes(data: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length
  } catch {
    return 0
  }
}

function getRecordSortTime(record: Pick<OfflineCacheRecord, 'lastAccessedAt' | 'updatedAt'>) {
  return record.lastAccessedAt || record.updatedAt
}

export function selectOfflineCacheVictims(
  records: OfflineCacheRecord[],
  policy: OfflineCachePolicy,
  now = Date.now(),
) {
  const victims = new Set<string>()

  for (const record of records) {
    if (record.expiresAt <= now) {
      victims.add(record.cacheKey)
    }
  }

  const remaining = records
    .filter(record => !victims.has(record.cacheKey))
    .sort((left, right) => getRecordSortTime(left) - getRecordSortTime(right))

  const overEntries = Math.max(0, remaining.length - policy.maxEntries)
  for (let index = 0; index < overEntries; index += 1) {
    victims.add(remaining[index].cacheKey)
  }

  let totalBytes = remaining
    .filter(record => !victims.has(record.cacheKey))
    .reduce((sum, record) => sum + record.approxBytes, 0)

  for (const record of remaining) {
    if (!victims.has(record.cacheKey) && totalBytes <= policy.maxBytes) break
    if (victims.has(record.cacheKey)) continue
    victims.add(record.cacheKey)
    totalBytes -= record.approxBytes
  }

  return [...victims]
}

async function deleteRecord(cacheKey: string) {
  const db = await getDb()
  if (!db) return

  try {
    await db.entries.delete(cacheKey)
  } catch {
    // Ignore cleanup failures; the in-memory cache is still authoritative for this session.
  }
}

async function touchRecord(cacheKey: string, lastAccessedAt: number) {
  const memoryHit = inMemoryCache.get(cacheKey)
  if (memoryHit) {
    memoryHit.lastAccessedAt = lastAccessedAt
  }

  const db = await getDb()
  if (!db) return

  try {
    await db.entries.update(cacheKey, { lastAccessedAt })
  } catch {
    // Ignore background touch failures.
  }
}

async function sweepScope(scope: string, policy: OfflineCachePolicy) {
  const db = await getDb()
  if (!db) return

  try {
    const records = await db.entries.where('scope').equals(scope).toArray()
    const victims = selectOfflineCacheVictims(records, policy)
    if (!victims.length) return

    await db.entries.bulkDelete(victims)
    victims.forEach(cacheKey => inMemoryCache.delete(cacheKey))
  } catch {
    // Best-effort cleanup only.
  }
}

function enqueueSweep(scope: string, policy: OfflineCachePolicy) {
  cleanupQueue = cleanupQueue
    .then(() => sweepScope(scope, policy))
    .catch(() => {})

  return cleanupQueue
}

async function readRecord(cacheKey: string) {
  const memoryHit = inMemoryCache.get(cacheKey)
  const now = Date.now()
  if (memoryHit) {
    if (memoryHit.expiresAt <= now) {
      inMemoryCache.delete(cacheKey)
      void deleteRecord(cacheKey)
      return null
    }

    void touchRecord(cacheKey, now)
    return memoryHit
  }

  const db = await getDb()
  if (!db) return null

  try {
    const stored = await db.entries.get(cacheKey)
    if (!stored) return null

    if (stored.expiresAt <= now) {
      inMemoryCache.delete(cacheKey)
      void deleteRecord(cacheKey)
      return null
    }

    inMemoryCache.set(cacheKey, stored)
    void touchRecord(cacheKey, now)
    return stored
  } catch {
    return null
  }
}

async function writeRecord(cacheKey: string, scope: string, data: unknown, policy: OfflineCachePolicy) {
  const now = Date.now()
  const approxBytes = estimateOfflineCacheBytes(data)
  const record: OfflineCacheRecordInput = {
    cacheKey,
    scope,
    data,
    updatedAt: now,
    lastAccessedAt: now,
    expiresAt: now + policy.maxAgeMs,
    approxBytes,
  }

  inMemoryCache.set(cacheKey, record)

  if (approxBytes > policy.maxBytes) {
    return
  }

  const db = await getDb()
  if (!db) return

  try {
    await db.entries.put(record)
    void enqueueSweep(scope, policy)
  } catch {
    // IndexedDB can be unavailable in private mode or tests; fall back to memory.
  }
}

export async function readOfflineCache<T>(parts: readonly unknown[]) {
  const cacheKey = createOfflineCacheKey(parts)
  const record = await readRecord(cacheKey)
  return record?.data as T | undefined
}

export async function writeOfflineCache<T>(parts: readonly unknown[], data: T, policy = getOfflineCachePolicy(parts)) {
  const cacheKey = createOfflineCacheKey(parts)
  await writeRecord(cacheKey, getCacheScope(parts), data, policy)
}

export async function fetchWithOfflineCache<T>(parts: readonly unknown[], fetcher: () => Promise<T>, policy = getOfflineCachePolicy(parts)) {
  const cached = await readOfflineCache<T>(parts)

  if (typeof navigator !== 'undefined' && !navigator.onLine && cached !== undefined) {
    return cached
  }

  try {
    const next = await fetcher()
    await writeOfflineCache(parts, next, policy)
    return next
  } catch (error) {
    if (cached !== undefined) return cached
    throw error
  }
}
