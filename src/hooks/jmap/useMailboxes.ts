import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { fetchWithOfflineCache } from '../../utils/offlineCache'
import { logger } from '../../utils/logger'
import { isDeferredMutationResult, runDeferredAwareMutation } from '../../utils/offlineSyncQueue'
import {
  invalidateMailboxQueries,
  jmapMethodCall,
  jmapRequest,
  rollbackMailboxes,
} from './queryCacheUtils'

export function useMailboxes() {
  const accountId = jmapClient.getPrimaryAccount()
  logger.debug('useMailboxes - Current accountId:', accountId)

  return useQuery({
    queryKey: ['mailboxes', accountId],
    queryFn: async () => fetchWithOfflineCache(['mailboxes', accountId], async () => {
      if (!accountId) {
        logger.warn('useMailboxes: No accountId, skipping fetch')
        return []
      }
      logger.debug('Fetching mailboxes for account:', accountId)
      try {
        const response = await jmapClient.request([
          ['Mailbox/get', {
            accountId,
            ids: null,
          }, '0'],
        ])

        logger.debug('Mailbox response:', response)

        if (!response || !response.methodResponses || response.methodResponses.length === 0) {
          logger.error('Empty JMAP response for mailboxes')
          return []
        }

        const methodRes = response.methodResponses[0]
        if (methodRes[0] === 'error') {
          logger.error('JMAP Method Error:', methodRes[1])
          return []
        }

        const list = methodRes[1].list
        if (!list) {
          logger.error('No list in Mailbox/get response:', methodRes[1])
          return []
        }

        return list.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
      } catch (err) {
        logger.error('Failed to fetch mailboxes:', err)
        throw err
      }
    }),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useMailboxActions() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  const createMailbox = useMutation({
    mutationFn: async ({ name, parentId }: { name: string, parentId?: string }) => {
      const createObj: any = {
        name,
        isSubscribed: true,
      }
      if (parentId) {
        createObj.parentId = parentId
      }

      const requests = [
        jmapMethodCall('Mailbox/set', {
          accountId,
          create: {
            [`mailbox-${Date.now()}`]: createObj,
          },
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'createMailbox',
        payload: {
          description: `Create mailbox ${name}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateMailboxQueries(queryClient)
    },
  })

  const renameMailbox = useMutation({
    mutationFn: async ({ mailboxId, newName }: { mailboxId: string, newName: string }) => {
      const requests = [
        jmapMethodCall('Mailbox/set', {
          accountId,
          update: {
            [mailboxId]: { name: newName },
          },
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'renameMailbox',
        payload: {
          description: `Rename mailbox ${mailboxId}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ mailboxId, newName }) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] })

      const previousMailboxes = queryClient.getQueryData(['mailboxes', accountId])

      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old
        return old.map((mb: any) =>
          mb.id === mailboxId ? { ...mb, name: newName } : mb,
        )
      })

      return { previousMailboxes }
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previousMailboxes),
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateMailboxQueries(queryClient)
    },
  })

  const deleteMailbox = useMutation({
    mutationFn: async ({ mailboxId }: { mailboxId: string }) => {
      const requests = [
        jmapMethodCall('Mailbox/set', {
          accountId,
          destroy: [mailboxId],
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'deleteMailbox',
        payload: {
          description: `Delete mailbox ${mailboxId}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ mailboxId }) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] })

      const previousMailboxes = queryClient.getQueryData(['mailboxes', accountId])

      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old
        return old.filter((mb: any) => mb.id !== mailboxId)
      })

      return { previousMailboxes }
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previousMailboxes),
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateMailboxQueries(queryClient)
    },
  })

  return { createMailbox, renameMailbox, deleteMailbox }
}

export function useMailboxReorder() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  const reorderMailbox = useMutation({
    mutationFn: async (updates: { mailboxId: string; sortOrder: number }[]) => {
      const updateObj: Record<string, { sortOrder: number }> = {}
      updates.forEach(({ mailboxId, sortOrder }) => {
        updateObj[mailboxId] = { sortOrder }
      })
      const requests = [
        jmapMethodCall('Mailbox/set', {
          accountId,
          update: updateObj,
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'reorderMailbox',
        payload: {
          description: `Reorder ${updates.length} mailboxes`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] })
      const previous = queryClient.getQueryData(['mailboxes', accountId])

      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old
        const orderMap = new Map(updates.map(u => [u.mailboxId, u.sortOrder]))
        return old.map((mb: any) =>
          orderMap.has(mb.id) ? { ...mb, sortOrder: orderMap.get(mb.id) } : mb,
        )
      })

      return { previous }
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previous),
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateMailboxQueries(queryClient)
    },
  })

  const reparentMailbox = useMutation({
    mutationFn: async ({ mailboxId, newParentId }: { mailboxId: string; newParentId: string | null }) => {
      const requests = [
        jmapMethodCall('Mailbox/set', {
          accountId,
          update: {
            [mailboxId]: { parentId: newParentId },
          },
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'reparentMailbox',
        payload: {
          description: `Reparent mailbox ${mailboxId}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ mailboxId, newParentId }) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] })
      const previous = queryClient.getQueryData(['mailboxes', accountId])

      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old
        return old.map((mb: any) =>
          mb.id === mailboxId ? { ...mb, parentId: newParentId } : mb,
        )
      })

      return { previous }
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previous),
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateMailboxQueries(queryClient)
    },
  })

  return { reorderMailbox, reparentMailbox }
}
