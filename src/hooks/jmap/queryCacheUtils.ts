import { QueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { sharedNotificationSuppressor } from '../../utils/notificationSuppressor'
import type { Mailbox } from '../../types/jmap'

export type JMAPRequestCall<TArgs extends Record<string, unknown> = Record<string, unknown>> = [
  method: string,
  args: TArgs,
  callId: string,
]

export function jmapMethodCall<TArgs extends Record<string, unknown>>(
  method: string,
  args: TArgs,
  callId: string,
): JMAPRequestCall<TArgs> {
  return [method, args, callId]
}

export function suppressNewMailNotification() {
  sharedNotificationSuppressor.suppress()
}

export function invalidateEmailQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['threads'] })
  queryClient.invalidateQueries({ queryKey: ['emails'] })
  queryClient.invalidateQueries({ queryKey: ['emailDetail'] })
  queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
}

export function invalidateMailboxQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
}

// Type for query snapshots from getQueriesData
export type QuerySnapshot<T = unknown> = [queryKey: readonly unknown[], data: T][]

export function rollbackQueries<T>(queryClient: QueryClient, snapshots: QuerySnapshot<T> | null | undefined) {
  if (snapshots && Array.isArray(snapshots)) {
    snapshots.forEach(([queryKey, data]) => {
      if (queryKey) {
        queryClient.setQueryData(queryKey, data)
      }
    })
  }
}

export function rollbackMailboxes(queryClient: QueryClient, accountId: string | null, previous: Mailbox[] | undefined) {
  if (previous) {
    queryClient.setQueryData(['mailboxes', accountId], previous)
  }
}

export function jmapRequest(requests: JMAPRequestCall[]) {
  return jmapClient.request(requests)
}
