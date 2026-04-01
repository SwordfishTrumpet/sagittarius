import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { isDeferredMutationResult, runDeferredAwareMutation } from '../../utils/offlineSyncQueue'
import {
  invalidateEmailQueries,
  jmapMethodCall,
  jmapRequest,
  rollbackQueries,
  suppressNewMailNotification,
} from './queryCacheUtils'

export function useEmailActions() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  const updateKeywords = useMutation({
    mutationFn: async ({ emailId, keywords }: { emailId: string, keywords: Record<string, boolean> }) => {
      const patch: Record<string, boolean | null> = {}
      for (const [key, value] of Object.entries(keywords)) {
        patch[`keywords/${key}`] = value ? true : null
      }
      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
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

      const previousEmailDetail = queryClient.getQueryData(['emailDetail', accountId, emailId])
      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })

      queryClient.setQueryData(['emailDetail', accountId, emailId], (old: any) => {
        if (!old) return old
        return old.map((email: any) =>
          email.id === emailId
            ? { ...email, keywords: { ...email.keywords, ...keywords } }
            : email,
        )
      })

      queryClient.getQueriesData({ queryKey: ['threads'] }).forEach(([queryKey, oldData]: any) => {
        if (!oldData) return
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old
          return old.map((email: any) =>
            email.id === emailId
              ? { ...email, keywords: { ...email.keywords, ...keywords } }
              : email,
          )
        })
      })

      return { previousEmailDetail, previousThreads }
    },
    onError: (_err, newData, context: any) => {
      if (context?.previousEmailDetail) {
        queryClient.setQueryData(['emailDetail', accountId, newData.emailId], context.previousEmailDetail)
      }
      rollbackQueries(queryClient, context?.previousThreads)
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateEmailQueries(queryClient)
    },
  })

  const updateKeywordsBulk = useMutation({
    mutationFn: async ({ emailIds, keywords }: { emailIds: string[], keywords: Record<string, boolean> }) => {
      const patch: Record<string, boolean | null> = {}
      for (const [key, value] of Object.entries(keywords)) {
        patch[`keywords/${key}`] = value ? true : null
      }
      const updates: Record<string, Record<string, boolean | null>> = {}
      emailIds.forEach((id: string) => {
        updates[id] = patch
      })
      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
          update: updates,
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'updateKeywordsBulk',
        payload: {
          description: `Toggle keywords for ${emailIds.length} emails`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ emailIds, keywords }) => {
      suppressNewMailNotification()

      await queryClient.cancelQueries({ queryKey: ['emailDetail'] })
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const emailIdSet = new Set(emailIds)
      const applyKeywordPatch = (email: any) => (
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
    onError: (_err, _newData, context: any) => {
      rollbackQueries(queryClient, context?.previousEmailDetail)
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateEmailQueries(queryClient)
    },
  })

  const moveEmail = useMutation({
    mutationFn: async ({ emailId, mailboxIds }: { emailId: string, mailboxIds: Record<string, boolean> }) => {
      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
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

      const threadQueriesSnapshot = queryClient.getQueriesData({ queryKey: ['threads'] })
      threadQueriesSnapshot.forEach(([queryKey, oldData]: any) => {
        if (!Array.isArray(oldData)) return

        const queryParams = queryKey as any[]
        const queriedMailboxId = queryParams[2]
        const isDestination = destinationMailboxIds.includes(queriedMailboxId)

        if (!isDestination) {
          queryClient.setQueryData(queryKey, oldData.filter((email: any) => email.id !== emailId))
        }
      })

      const emailQueriesSnapshot = queryClient.getQueriesData({ queryKey: ['emails'] })
      emailQueriesSnapshot.forEach(([queryKey, oldData]: any) => {
        if (!Array.isArray(oldData)) return

        const queryParams = queryKey as any[]
        const queriedMailboxId = queryParams[2]
        const isDestination = destinationMailboxIds.includes(queriedMailboxId)

        if (!isDestination) {
          queryClient.setQueryData(queryKey, oldData.filter((email: any) => email.id !== emailId))
        }
      })

      return { previousThreads, previousEmails }
    },
    onError: (_err, _newData, context: any) => {
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
      const updates: Record<string, { mailboxIds: Record<string, boolean> }> = {}
      emailIds.forEach((id: string) => {
        updates[id] = { mailboxIds }
      })
      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
          update: updates,
        }, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'moveEmailBulk',
        payload: {
          description: `Move ${emailIds.length} emails`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ emailIds, mailboxIds }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const destinationMailboxIds = Object.keys(mailboxIds).filter(id => mailboxIds[id])
      const emailIdSet = new Set(emailIds)

      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      queryClient.getQueriesData({ queryKey: ['threads'] }).forEach(([queryKey, oldData]: any) => {
        if (!Array.isArray(oldData)) return
        const queriedMailboxId = (queryKey as any[])[2]
        if (!destinationMailboxIds.includes(queriedMailboxId)) {
          queryClient.setQueryData(queryKey, oldData.filter((email: any) => !emailIdSet.has(email.id)))
        }
      })

      queryClient.getQueriesData({ queryKey: ['emails'] }).forEach(([queryKey, oldData]: any) => {
        if (!Array.isArray(oldData)) return
        const queriedMailboxId = (queryKey as any[])[2]
        if (!destinationMailboxIds.includes(queriedMailboxId)) {
          queryClient.setQueryData(queryKey, oldData.filter((email: any) => !emailIdSet.has(email.id)))
        }
      })

      return { previousThreads, previousEmails }
    },
    onError: (_err, _newData, context: any) => {
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateEmailQueries(queryClient)
    },
  })

  return { updateKeywords, updateKeywordsBulk, moveEmail, moveEmailBulk }
}
