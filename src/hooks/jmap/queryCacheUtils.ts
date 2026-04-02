import { QueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { sharedNotificationSuppressor } from '../../utils/notificationSuppressor'

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

export function rollbackQueries(queryClient: QueryClient, snapshots: unknown) {
  if (snapshots && Array.isArray(snapshots)) {
    snapshots.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey as unknown[], data)
    })
  }
}

export function rollbackMailboxes(queryClient: QueryClient, accountId: string | null, previous: any) {
  if (previous) {
    queryClient.setQueryData(['mailboxes', accountId], previous)
  }
}

export function jmapRequest(requests: JMAPRequestCall[]) {
  return jmapClient.request(requests)
}
