import Dexie, { type Table } from 'dexie'
import { jmapClient } from '../api/jmap'
import { stateManager } from '../api/stateManager'
import type {
  DeferredMutation,
  DeferredMutationPayload,
  DeferredMutationResult,
  OfflineJmapRequest,
} from '../types/offline'

const OFFLINE_SYNC_QUEUE_CHANGED_EVENT = 'sagittarius-offline-sync-queue-changed'

// Type guards for JMAP error handling
interface JMAPError {
  type: string
  description?: string
}

interface JMAPMethodResult {
  notCreated?: Record<string, JMAPError>
  notUpdated?: Record<string, JMAPError>
  notDestroyed?: Record<string, JMAPError>
}

interface JMAPResponse {
  methodResponses: Array<[string, JMAPMethodResult | JMAPError, string]>
}

class OfflineSyncQueueDB extends Dexie {
  mutations!: Table<DeferredMutation, string>

  constructor() {
    super('sagittarius-offline-sync')
    this.version(1).stores({
      mutations: '&id, accountId, operation, createdAt',
    })
  }
}

const supportsIndexedDB = typeof indexedDB !== 'undefined'
const inMemoryMutations = new Map<string, DeferredMutation>()
let dbPromise: Promise<OfflineSyncQueueDB | null> | null = null

function getDb() {
  if (!supportsIndexedDB) return Promise.resolve(null)
  if (!dbPromise) {
    dbPromise = Promise.resolve(new OfflineSyncQueueDB())
  }
  return dbPromise
}

function emitQueueChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OFFLINE_SYNC_QUEUE_CHANGED_EVENT))
}

function createMutationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function persistMutation(record: DeferredMutation) {
  inMemoryMutations.set(record.id, record)

  const db = await getDb()
  if (!db) {
    emitQueueChanged()
    return record
  }

  try {
    await db.mutations.put(record)
  } catch {
    // Dexie can fail in private mode or constrained test environments.
  }

  emitQueueChanged()
  return record
}

async function removeMutation(id: string) {
  inMemoryMutations.delete(id)

  const db = await getDb()
  if (db) {
    try {
      await db.mutations.delete(id)
    } catch {
      // Ignore storage failures and keep the in-memory copy cleared.
    }
  }

  emitQueueChanged()
}

async function loadMutations() {
  const db = await getDb()
  if (!db) {
    return Array.from(inMemoryMutations.values()).sort((a, b) => a.createdAt - b.createdAt)
  }

  try {
    const records = await db.mutations.toArray()
    records.forEach(record => inMemoryMutations.set(record.id, record))
    return records.sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return Array.from(inMemoryMutations.values()).sort((a, b) => a.createdAt - b.createdAt)
  }
}

function toResult(record: DeferredMutation): DeferredMutationResult {
  return {
    deferred: true,
    mutationId: record.id,
    operation: record.operation,
    description: record.payload.description,
    queuedAt: record.createdAt,
  }
}

export function assertSuccessfulJmapResponse(response: unknown) {
  const methodResponses = 
    response && typeof response === 'object' && 'methodResponses' in response
      ? (response as JMAPResponse).methodResponses 
      : []
      
  for (const [method, result] of methodResponses) {
    if (method === 'error') {
      const errorResult = result as JMAPError
      throw new Error(errorResult?.description || errorResult?.type || 'JMAP error')
    }

    const methodResult = result as JMAPMethodResult
    if (methodResult?.notCreated && Object.keys(methodResult.notCreated).length > 0) {
      const firstError = Object.values(methodResult.notCreated)[0] as JMAPError
      throw new Error(firstError?.description || firstError?.type || 'JMAP create failed')
    }

    if (methodResult?.notUpdated && Object.keys(methodResult.notUpdated).length > 0) {
      const firstError = Object.values(methodResult.notUpdated)[0] as JMAPError
      throw new Error(firstError?.description || firstError?.type || 'JMAP update failed')
    }

    if (methodResult?.notDestroyed && Object.keys(methodResult.notDestroyed).length > 0) {
      const firstError = Object.values(methodResult.notDestroyed)[0] as JMAPError
      throw new Error(firstError?.description || firstError?.type || 'JMAP destroy failed')
    }
  }
}

export function isDeferredMutationResult(value: unknown): value is DeferredMutationResult {
  return Boolean(value && typeof value === 'object' && 'deferred' in value)
}

export async function enqueueDeferredMutation(input: {
  accountId: string
  operation: string
  payload: DeferredMutationPayload
}) {
  const record: DeferredMutation = {
    id: createMutationId(),
    accountId: input.accountId,
    operation: input.operation,
    payload: input.payload,
    createdAt: Date.now(),
    attemptCount: 0,
    lastError: null,
  }

  await persistMutation(record)
  return toResult(record)
}

export async function getDeferredMutationCount() {
  const records = await loadMutations()
  return records.length
}

export async function listDeferredMutations() {
  return loadMutations()
}

export async function clearDeferredMutations() {
  const records = await loadMutations()
  await Promise.all(records.map(record => removeMutation(record.id)))
}

// Processing lock to prevent concurrent replays
let isReplaying = false

export async function replayDeferredMutations() {
  // Prevent concurrent replays which could cause duplicate processing
  if (isReplaying) {
    return { syncedCount: 0, errors: [{ id: 'lock', error: 'Replay already in progress' }] }
  }
  
  isReplaying = true
  
  try {
    const queued = await loadMutations()
    let syncedCount = 0
    const errors: Array<{ id: string; error: string }> = []
    
    // Process mutations one at a time
    for (const record of queued) {
      try {
        const response = await jmapClient.request(record.payload.requests as OfflineJmapRequest[])
        assertSuccessfulJmapResponse(response)
        // Sync Email state from replayed Email/set responses
        if (response && typeof response === 'object' && 'methodResponses' in response) {
          const methodResponses = (response as JMAPResponse).methodResponses
          for (const [method, result] of methodResponses) {
            if (method === 'Email/set' && result && typeof result === 'object' && 'newState' in (result as Record<string, unknown>)) {
              stateManager.setState('Email', (result as Record<string, string>).newState)
              break
            }
          }
        }
        await removeMutation(record.id)
        syncedCount += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const updated: DeferredMutation = {
          ...record,
          attemptCount: record.attemptCount + 1,
          lastError: message,
        }
        await persistMutation(updated)
        errors.push({ id: record.id, error: message })
        // Continue processing remaining mutations instead of breaking
        // This allows independent mutations to succeed even if one fails
      }
    }

    return { syncedCount, errors }
  } finally {
    isReplaying = false
  }
}

export async function runDeferredAwareMutation<T>(args: {
  accountId: string | null
  operation: string
  payload: DeferredMutationPayload
  execute: () => Promise<T>
}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (!args.accountId) {
      throw new Error('No account available for offline mutation queueing')
    }
    return enqueueDeferredMutation({
      accountId: args.accountId,
      operation: args.operation,
      payload: args.payload,
    }) as Promise<T | DeferredMutationResult>
  }

  return args.execute()
}

export function subscribeOfflineQueueChanges(listener: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener(OFFLINE_SYNC_QUEUE_CHANGED_EVENT, listener)
  return () => window.removeEventListener(OFFLINE_SYNC_QUEUE_CHANGED_EVENT, listener)
}
