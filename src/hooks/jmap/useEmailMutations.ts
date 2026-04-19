import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { stateManager } from '../../api/stateManager'
import { isDeferredMutationResult, runDeferredAwareMutation } from '../../utils/offlineSyncQueue'
import { chunkForSet } from '../../utils/capabilityUtils'
import type { Email } from '../../types/jmap'
import {
  invalidateEmailQueries,
  jmapMethodCall,
  jmapRequest,
  rollbackQueries,
  suppressNewMailNotification,
  type QuerySnapshot,
} from './queryCacheUtils'

import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query'

interface EmailActionsReturn {
  updateKeywords: {
    mutate: UseMutateFunction<unknown, Error, { emailId: string; keywords: Record<string, boolean> }, unknown>
    mutateAsync: UseMutateAsyncFunction<unknown, Error, { emailId: string; keywords: Record<string, boolean> }, unknown>
    isPending: boolean
  }
  updateKeywordsBulk: {
    mutate: UseMutateFunction<unknown, Error, { emailIds: string[]; keywords: Record<string, boolean> }, unknown>
    mutateAsync: UseMutateAsyncFunction<unknown, Error, { emailIds: string[]; keywords: Record<string, boolean> }, unknown>
    isPending: boolean
  }
  moveEmail: {
    mutate: UseMutateFunction<unknown, Error, { emailId: string; mailboxIds: Record<string, boolean> }, unknown>
    mutateAsync: UseMutateAsyncFunction<unknown, Error, { emailId: string; mailboxIds: Record<string, boolean> }, unknown>
    isPending: boolean
  }
  moveEmailBulk: {
    mutate: UseMutateFunction<unknown, Error, { emailIds: string[]; mailboxIds: Record<string, boolean> }, unknown>
    mutateAsync: UseMutateAsyncFunction<unknown, Error, { emailIds: string[]; mailboxIds: Record<string, boolean> }, unknown>
    isPending: boolean
  }
  destroyEmail: {
    mutate: UseMutateFunction<unknown, Error, { emailId: string }, unknown>
    mutateAsync: UseMutateAsyncFunction<unknown, Error, { emailId: string }, unknown>
    isPending: boolean
  }
  destroyEmailBulk: {
    mutate: UseMutateFunction<unknown, Error, { emailIds: string[] }, unknown>
    mutateAsync: UseMutateAsyncFunction<unknown, Error, { emailIds: string[] }, unknown>
    isPending: boolean
  }
}

export function useEmailActions(): EmailActionsReturn {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  const updateKeywords = useMutation({
    mutationFn: async ({ emailId, keywords }: { emailId: string, keywords: Record<string, boolean> }) => {
      if (!accountId) throw new Error('No account available')
      const patch: Record<string, boolean | null> = {}
      for (const [key, value] of Object.entries(keywords)) {
        patch[`keywords/${key}`] = value ? true : null
      }
      // Include ifInState for conflict detection per RFC 8620
      const emailState = stateManager.getState('Email')
      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
          ifInState: emailState || undefined,
          update: {
            [emailId]: patch,
          },
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'updateKeywords',
        payload: {
          description: `Toggle keywords for ${emailId}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ emailId, keywords }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['emailDetail'] })
      await queryClient.cancelQueries({ queryKey: ['threads'] })

      // Capture mailboxId in closure for proper rollback
      const previousEmailDetail = queryClient.getQueryData<Email[]>(['emailDetail', accountId, emailId])
      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      // Store the query keys for proper rollback
      const affectedThreadQueryKeys = previousThreads.map(([queryKey]) => queryKey)

      queryClient.setQueryData(['emailDetail', accountId, emailId], (old: Email[] | undefined) => {
        if (!old) return old
        return old.map((email) =>
          email.id === emailId
            ? { ...email, keywords: { ...email.keywords, ...keywords } }
            : email,
        )
      })

      // Reuse previousThreads to avoid double query
      previousThreads.forEach(([queryKey, oldData]) => {
        if (!oldData) return
        queryClient.setQueryData(queryKey, (old: Email[] | undefined) => {
          if (!old) return old
          return old.map((email) =>
            email.id === emailId
              ? { ...email, keywords: { ...email.keywords, ...keywords } }
              : email,
          )
        })
      })

      return { previousEmailDetail, previousThreads, affectedThreadQueryKeys, emailId }
    },
    onError: (_err, newData, context: { previousEmailDetail?: Email[]; previousThreads?: QuerySnapshot; affectedThreadQueryKeys?: (readonly unknown[])[]; emailId?: string } | undefined) => {
      // Rollback to correct cache using captured context
      if (context?.emailId) {
        if (context?.previousEmailDetail) {
          queryClient.setQueryData(['emailDetail', accountId, context.emailId], context.previousEmailDetail)
        }
        rollbackQueries(queryClient, context?.previousThreads)
      }
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateEmailQueries(queryClient)
    },
  })

  const updateKeywordsBulk = useMutation({
    mutationFn: async ({ emailIds, keywords }: { emailIds: string[], keywords: Record<string, boolean> }) => {
      if (!accountId) throw new Error('No account available')
      const patch: Record<string, boolean | null> = {}
      for (const [key, value] of Object.entries(keywords)) {
        patch[`keywords/${key}`] = value ? true : null
      }

      // Chunk email IDs to respect maxObjectsInSet server limit (RFC 8620)
      const chunks = chunkForSet(emailIds)
      const emailState = stateManager.getState('Email')

      // Execute each chunk as a separate request
      const results = []
      for (const chunk of chunks) {
        const updates: Record<string, Record<string, boolean | null>> = {}
        chunk.forEach((id: string) => {
          updates[id] = patch
        })

        const requests = [
          jmapMethodCall('Email/set', {
            accountId,
            ifInState: emailState || undefined,
            update: updates,
          }, '0'),
        ]

        const result = await runDeferredAwareMutation({
          accountId,
          operation: 'updateKeywordsBulk',
          payload: {
            description: `Toggle keywords for ${chunk.length} emails`,
            requests,
          },
          execute: () => jmapRequest(requests),
        })

        results.push(result)
      }

      return results
    },
    onMutate: async ({ emailIds, keywords }) => {
      suppressNewMailNotification()

      await queryClient.cancelQueries({ queryKey: ['emailDetail'] })
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const emailIdSet = new Set(emailIds)
      const applyKeywordPatch = (email: Email) => (
        emailIdSet.has(email.id)
          ? { ...email, keywords: { ...(email.keywords ?? {}), ...keywords } }
          : email
      )

      const previousEmailDetail = queryClient.getQueriesData({ queryKey: ['emailDetail'] })
      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      previousEmailDetail.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        queryClient.setQueryData(queryKey, oldData.map(applyKeywordPatch))
      })

      previousThreads.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        queryClient.setQueryData(queryKey, oldData.map(applyKeywordPatch))
      })

      previousEmails.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        queryClient.setQueryData(queryKey, oldData.map(applyKeywordPatch))
      })

      return { previousEmailDetail, previousThreads, previousEmails }
    },
    onError: (_err, _newData, context: { previousEmailDetail?: QuerySnapshot; previousThreads?: QuerySnapshot; previousEmails?: QuerySnapshot } | undefined) => {
      rollbackQueries(queryClient, context?.previousEmailDetail)
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (results) => {
      // Check if any result is deferred
      const hasDeferred = Array.isArray(results) && results.some(r => isDeferredMutationResult(r))
      if (hasDeferred) return
      invalidateEmailQueries(queryClient)
    },
  })

  const moveEmail = useMutation({
    mutationFn: async ({ emailId, mailboxIds }: { emailId: string, mailboxIds: Record<string, boolean> }) => {
      if (!accountId) throw new Error('No account available')
      // Include ifInState for conflict detection per RFC 8620
      const emailState = stateManager.getState('Email')
      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
          ifInState: emailState || undefined,
          update: {
            [emailId]: { mailboxIds },
          },
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'moveEmail',
        payload: {
          description: `Move ${emailId}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ emailId, mailboxIds }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const destinationMailboxIds = Object.keys(mailboxIds).filter(id => mailboxIds[id])

      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      // Reuse previousThreads to avoid double query
      previousThreads.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return

        const queryParams = queryKey as string[]
        const queriedMailboxId = queryParams[2]
        const isDestination = destinationMailboxIds.includes(queriedMailboxId)

        if (!isDestination) {
          queryClient.setQueryData(queryKey, oldData.filter((email: Email) => email.id !== emailId))
        }
      })

      // Reuse previousEmails to avoid double query
      previousEmails.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return

        const queryParams = queryKey as string[]
        const queriedMailboxId = queryParams[2]
        const isDestination = destinationMailboxIds.includes(queriedMailboxId)

        if (!isDestination) {
          queryClient.setQueryData(queryKey, oldData.filter((email: Email) => email.id !== emailId))
        }
      })

      return { previousThreads, previousEmails }
    },
    onError: (_err, _newData, context: { previousThreads?: QuerySnapshot; previousEmails?: QuerySnapshot } | undefined) => {
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateEmailQueries(queryClient)
    },
  })

  const moveEmailBulk = useMutation({
    mutationFn: async ({ emailIds, mailboxIds }: { emailIds: string[], mailboxIds: Record<string, boolean> }) => {
      if (!accountId) throw new Error('No account available')
      // Chunk email IDs to respect maxObjectsInSet server limit (RFC 8620)
      const chunks = chunkForSet(emailIds)
      const emailState = stateManager.getState('Email')

      // Execute each chunk as a separate request
      const results = []
      for (const chunk of chunks) {
        const updates: Record<string, { mailboxIds: Record<string, boolean> }> = {}
        chunk.forEach((id: string) => {
          updates[id] = { mailboxIds }
        })

        const requests = [
          jmapMethodCall('Email/set', {
            accountId,
            ifInState: emailState || undefined,
            update: updates,
          }, '0'),
        ]

        const result = await runDeferredAwareMutation({
          accountId,
          operation: 'moveEmailBulk',
          payload: {
            description: `Move ${chunk.length} emails`,
            requests,
          },
          execute: () => jmapRequest(requests),
        })

        results.push(result)
      }

      return results
    },
    onMutate: async ({ emailIds, mailboxIds }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const destinationMailboxIds = Object.keys(mailboxIds).filter(id => mailboxIds[id])
      const emailIdSet = new Set(emailIds)

      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      // Reuse previousThreads to avoid double query
      previousThreads.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        const queriedMailboxId = (queryKey as string[])[2]
        if (!destinationMailboxIds.includes(queriedMailboxId)) {
          queryClient.setQueryData(queryKey, oldData.filter((email: Email) => !emailIdSet.has(email.id)))
        }
      })

      // Reuse previousEmails to avoid double query
      previousEmails.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        const queriedMailboxId = (queryKey as string[])[2]
        if (!destinationMailboxIds.includes(queriedMailboxId)) {
          queryClient.setQueryData(queryKey, oldData.filter((email: Email) => !emailIdSet.has(email.id)))
        }
      })

      return { previousThreads, previousEmails }
    },
    onError: (_err, _newData, context: { previousThreads?: QuerySnapshot; previousEmails?: QuerySnapshot } | undefined) => {
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (results) => {
      // Check if any result is deferred
      const hasDeferred = Array.isArray(results) && results.some(r => isDeferredMutationResult(r))
      if (hasDeferred) return
      invalidateEmailQueries(queryClient)
    },
  })

  const destroyEmail = useMutation({
    mutationFn: async ({ emailId }: { emailId: string }) => {
      if (!accountId) throw new Error('No account available')
      // Include ifInState for conflict detection per RFC 8620
      const emailState = stateManager.getState('Email')
      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
          ifInState: emailState || undefined,
          destroy: [emailId],
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'destroyEmail',
        payload: {
          description: `Permanently delete ${emailId}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ emailId }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      // Reuse previousThreads to avoid double query
      previousThreads.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        queryClient.setQueryData(queryKey, oldData.filter((email: Email) => email.id !== emailId))
      })

      // Reuse previousEmails to avoid double query
      previousEmails.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        queryClient.setQueryData(queryKey, oldData.filter((email: Email) => email.id !== emailId))
      })

      return { previousThreads, previousEmails }
    },
    onError: (_err, _newData, context: { previousThreads?: QuerySnapshot; previousEmails?: QuerySnapshot } | undefined) => {
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateEmailQueries(queryClient)
    },
  })

  const destroyEmailBulk = useMutation({
    mutationFn: async ({ emailIds }: { emailIds: string[] }) => {
      if (!accountId) throw new Error('No account available')
      // Chunk email IDs to respect maxObjectsInSet server limit (RFC 8620)
      const chunks = chunkForSet(emailIds)
      const emailState = stateManager.getState('Email')

      // Execute each chunk as a separate request
      const results = []
      for (const chunk of chunks) {
        const requests = [
          jmapMethodCall('Email/set', {
            accountId,
            ifInState: emailState || undefined,
            destroy: chunk,
          }, '0'),
        ]

        const result = await runDeferredAwareMutation({
          accountId,
          operation: 'destroyEmailBulk',
          payload: {
            description: `Permanently delete ${chunk.length} emails`,
            requests,
          },
          execute: () => jmapRequest(requests),
        })

        results.push(result)
      }

      return results
    },
    onMutate: async ({ emailIds }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const emailIdSet = new Set(emailIds)
      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      // Reuse previousThreads to avoid double query
      previousThreads.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        queryClient.setQueryData(queryKey, oldData.filter((email: Email) => !emailIdSet.has(email.id)))
      })

      // Reuse previousEmails to avoid double query
      previousEmails.forEach(([queryKey, oldData]) => {
        if (!Array.isArray(oldData)) return
        queryClient.setQueryData(queryKey, oldData.filter((email: Email) => !emailIdSet.has(email.id)))
      })

      return { previousThreads, previousEmails }
    },
    onError: (_err, _newData, context: { previousThreads?: QuerySnapshot; previousEmails?: QuerySnapshot } | undefined) => {
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (results) => {
      // Check if any result is deferred
      const hasDeferred = Array.isArray(results) && results.some(r => isDeferredMutationResult(r))
      if (hasDeferred) return
      invalidateEmailQueries(queryClient)
    },
  })

  return { updateKeywords, updateKeywordsBulk, moveEmail, moveEmailBulk, destroyEmail, destroyEmailBulk }
}
