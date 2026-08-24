export type OfflineJmapRequest = [string, Record<string, unknown>, string]

export type DeferredMutationPayload = {
  description: string
  requests: OfflineJmapRequest[]
}

export type DeferredMutation = {
  id: string
  accountId: string
  operation: string
  payload: DeferredMutationPayload
  createdAt: number
  attemptCount: number
  lastError?: string | null
  /** Set once the record exceeded MAX_ATTEMPTS and is excluded from replay. */
  failedAt?: number | null
}

export type DeferredMutationResult = {
  deferred: true
  mutationId: string
  operation: string
  description: string
  queuedAt: number
}
