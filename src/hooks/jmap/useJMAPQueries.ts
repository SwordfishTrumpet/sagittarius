import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { logger } from '../../utils/logger'
import { isDeferredMutationResult, runDeferredAwareMutation } from '../../utils/offlineSyncQueue'
import type {
  Mailbox,
  Thread,
  Identity,
  MailboxFilter,
  ThreadFilter,
  IdentityFilter,
  JMAPSortComparator,
  EmailCopyRequest,
  EmailCopyResponse,
  JMAPQueryResponse,
  JMAPGetResponse,
  Email,
  Quota,
  QuotaFilter,
} from '../../types/jmap'
import {
  invalidateMailboxQueries,
  invalidateEmailQueries,
  jmapMethodCall,
  jmapRequest,
  rollbackQueries,
  suppressNewMailNotification,
  type QuerySnapshot,
} from './queryCacheUtils'

// ============ Helper Functions ============

function asQueryResponse(data: unknown): JMAPQueryResponse {
  return data as JMAPQueryResponse
}

function asGetResponse<T>(data: unknown): JMAPGetResponse<T> {
  return data as JMAPGetResponse<T>
}

// ============ Mailbox/query Hook ============

export interface UseMailboxQueryOptions {
  filter?: MailboxFilter
  sort?: JMAPSortComparator[]
  limit?: number
  position?: number
}

/**
 * Hook for Mailbox/query - Search/filter mailboxes per RFC 8621 §4.4
 * 
 * @example
 * // Search for mailboxes by name
 * const { data: mailboxes } = useMailboxQuery({
 *   filter: { name: 'inbox' }
 * })
 * 
 * // Find subscribed mailboxes only
 * const { data: mailboxes } = useMailboxQuery({
 *   filter: { isSubscribed: true }
 * })
 */
export function useMailboxQuery(options: UseMailboxQueryOptions = {}) {
  const accountId = jmapClient.getPrimaryAccount()
  const { filter, sort, limit = 100, position = 0 } = options

  return useQuery({
    queryKey: ['mailboxQuery', accountId, filter ? JSON.stringify(filter) : null, sort ? JSON.stringify(sort) : null, limit, position],
    queryFn: async () => {
      if (!accountId) {
        logger.warn('useMailboxQuery: No accountId, skipping fetch')
        return []
      }

      // Step 1: Query for mailbox IDs matching filter
      const queryResponse = await jmapClient.request([
        ['Mailbox/query', {
          accountId,
          filter: filter || undefined,
          sort: sort || [{ property: 'sortOrder', isAscending: true }],
          limit,
          position,
        }, '0'],
      ])

      const queryResult = asQueryResponse(queryResponse.methodResponses[0][1])
      const ids = queryResult.ids

      if (!ids || ids.length === 0) return []

      // Step 2: Get full mailbox details
      const getResponse = await jmapClient.request([
        ['Mailbox/get', {
          accountId,
          ids,
          properties: ['id', 'name', 'parentId', 'role', 'sortOrder', 'totalEmails', 'unreadEmails', 'totalThreads', 'unreadThreads', 'myRights', 'isSubscribed', 'childIds'],
        }, '1'],
      ])

      const getResult = asGetResponse<Mailbox>(getResponse.methodResponses[0][1])
      return getResult.list || []
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ============ Thread/query Hook ============

export interface UseThreadQueryOptions {
  filter?: ThreadFilter
  sort?: JMAPSortComparator[]
  limit?: number
  position?: number
}

/**
 * Hook for Thread/query - Search/filter threads per RFC 8621 §4.4
 * 
 * @example
 * // Find threads with specific participant
 * const { data: threads } = useThreadQuery({
 *   filter: { from: 'john@example.com' }
 * })
 * 
 * // Find threads with attachments in date range
 * const { data: threads } = useThreadQuery({
 *   filter: {
 *     allOf: [
 *       { hasAttachment: true },
 *       { after: '2024-01-01T00:00:00Z' }
 *     ]
 *   }
 * })
 */
export function useThreadQuery(options: UseThreadQueryOptions = {}) {
  const accountId = jmapClient.getPrimaryAccount()
  const { filter, sort, limit = 100, position = 0 } = options

  return useQuery({
    queryKey: ['threadQuery', accountId, filter ? JSON.stringify(filter) : null, sort ? JSON.stringify(sort) : null, limit, position],
    queryFn: async () => {
      if (!accountId) {
        logger.warn('useThreadQuery: No accountId, skipping fetch')
        return []
      }

      // Step 1: Query for thread IDs matching filter
      const queryResponse = await jmapClient.request([
        ['Thread/query', {
          accountId,
          filter: filter || undefined,
          sort: sort || [{ property: 'receivedAt', isAscending: false }],
          limit,
          position,
        }, '0'],
      ])

      const queryResult = asQueryResponse(queryResponse.methodResponses[0][1])
      const ids = queryResult.ids

      if (!ids || ids.length === 0) return []

      // Step 2: Get full thread details
      const getResponse = await jmapClient.request([
        ['Thread/get', {
          accountId,
          ids,
        }, '1'],
      ])

      const getResult = asGetResponse<Thread>(getResponse.methodResponses[0][1])
      return getResult.list || []
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ============ Identity/query Hook ============

export interface UseIdentityQueryOptions {
  filter?: IdentityFilter
  sort?: JMAPSortComparator[]
  limit?: number
  position?: number
}

/**
 * Hook for Identity/query - Search/filter identities
 * 
 * @example
 * // Find identities by email pattern
 * const { data: identities } = useIdentityQuery({
 *   filter: { email: '@example.com' }
 * })
 * 
 * // Find deletable identities only
 * const { data: identities } = useIdentityQuery({
 *   filter: { mayDelete: true }
 * })
 */
export function useIdentityQuery(options: UseIdentityQueryOptions = {}) {
  const accountId = jmapClient.getPrimaryAccount()
  const { filter, sort, limit = 100, position = 0 } = options

  return useQuery({
    queryKey: ['identityQuery', accountId, filter ? JSON.stringify(filter) : null, sort ? JSON.stringify(sort) : null, limit, position],
    queryFn: async () => {
      if (!accountId) {
        logger.warn('useIdentityQuery: No accountId, skipping fetch')
        return []
      }

      // Step 1: Query for identity IDs matching filter
      const queryResponse = await jmapClient.request([
        ['Identity/query', {
          accountId,
          filter: filter || undefined,
          sort: sort || [{ property: 'email', isAscending: true }],
          limit,
          position,
        }, '0'],
      ])

      const queryResult = asQueryResponse(queryResponse.methodResponses[0][1])
      const ids = queryResult.ids

      if (!ids || ids.length === 0) return []

      // Step 2: Get full identity details
      const getResponse = await jmapClient.request([
        ['Identity/get', {
          accountId,
          ids,
          properties: ['id', 'name', 'email', 'replyTo', 'bcc', 'textSignature', 'htmlSignature', 'mayDelete'],
        }, '1'],
      ])

      const getResult = asGetResponse<Identity>(getResponse.methodResponses[0][1])
      return getResult.list || []
    },
    enabled: !!accountId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// ============ Quota/query Hook ============

export interface UseQuotaQueryOptions {
  filter?: QuotaFilter
  sort?: JMAPSortComparator[]
  limit?: number
  position?: number
}

/**
 * Hook for Quota/query - Search/filter quotas per RFC 9425
 *
 * @example
 * // Find quotas by resource type
 * const { data: quotas } = useQuotaQuery({
 *   filter: { resourceType: 'octets' }
 * })
 *
 * // Find quotas by scope
 * const { data: quotas } = useQuotaQuery({
 *   filter: { scope: 'account' }
 * })
 *
 * // Complex filter with multiple conditions
 * const { data: quotas } = useQuotaQuery({
 *   filter: {
 *     allOf: [
 *       { resourceType: 'octets' },
 *       { scope: 'account' }
 *     ]
 *   }
 * })
 */
export function useQuotaQuery(options: UseQuotaQueryOptions = {}) {
  const accountId = jmapClient.getPrimaryAccount()
  const { filter, sort, limit = 100, position = 0 } = options

  return useQuery({
    queryKey: ['quotaQuery', accountId, filter ? JSON.stringify(filter) : null, sort ? JSON.stringify(sort) : null, limit, position],
    queryFn: async () => {
      if (!accountId) {
        logger.warn('useQuotaQuery: No accountId, skipping fetch')
        return []
      }

      // Step 1: Query for quota IDs matching filter
      const queryResponse = await jmapClient.request([
        ['Quota/query', {
          accountId,
          filter: filter || undefined,
          sort: sort || [{ property: 'name', isAscending: true }],
          limit,
          position,
        }, '0'],
      ])

      const queryResult = asQueryResponse(queryResponse.methodResponses[0][1])
      const ids = queryResult.ids

      if (!ids || ids.length === 0) return []

      // Step 2: Get full quota details
      const getResponse = await jmapClient.request([
        ['Quota/get', {
          accountId,
          ids,
          properties: ['id', 'resourceType', 'used', 'hardLimit', 'scope', 'name', 'warnLimit', 'softLimit', 'description', 'types'],
        }, '1'],
      ])

      const getResult = asGetResponse<Quota>(getResponse.methodResponses[0][1])
      return getResult.list || []
    },
    enabled: !!accountId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// ============ Email/copy Hook ============

export interface EmailCopyVariables {
  emailId: string
  sourceMailboxId?: string
  targetMailboxIds: Record<string, boolean>
  fromAccountId?: string
  copyKeywords?: boolean
}

/**
 * Hook for Email/copy - Copy emails between mailboxes/accounts per RFC 8620 §5.4
 * 
 * @example
 * // Copy email to another mailbox
 * const { mutate: copyEmail } = useEmailCopy()
 * copyEmail({
 *   emailId: 'email-123',
 *   targetMailboxIds: { 'mailbox-456': true }
 * })
 * 
 * // Copy with keywords preserved
 * copyEmail({
 *   emailId: 'email-123',
 *   targetMailboxIds: { 'mailbox-456': true },
 *   copyKeywords: true
 * })
 */
export function useEmailCopy() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      emailId,
      sourceMailboxId,
      targetMailboxIds,
      fromAccountId,
      copyKeywords = false,
    }: EmailCopyVariables) => {
      if (!accountId) {
        throw new Error('No account available for Email/copy')
      }

      // If copying between accounts, use the provided fromAccountId
      // Otherwise, we're copying within the same account
      const sourceAccountId = fromAccountId || accountId

      // Fetch the source email to get its keywords if needed
      let keywords: Record<string, boolean> | undefined
      if (copyKeywords) {
        const emailResponse = await jmapClient.request([
          ['Email/get', {
            accountId: sourceAccountId,
            ids: [emailId],
            properties: ['keywords'],
          }, 'get0'],
        ])
        const emailResult = asGetResponse<Email>(emailResponse.methodResponses[0][1])
        keywords = emailResult.list?.[0]?.keywords
      }

      const createObj: { id: string; mailboxIds: Record<string, boolean>; keywords?: Record<string, boolean> } = {
        id: emailId,
        mailboxIds: targetMailboxIds,
      }
      if (copyKeywords && keywords) {
        createObj.keywords = keywords
      }

      const request: EmailCopyRequest = {
        accountId,
        fromAccountId: sourceAccountId,
        create: {
          [`copy-${Date.now()}`]: createObj,
        },
      }

      const requests = [
        jmapMethodCall('Email/copy', request as unknown as Record<string, unknown>, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'copyEmail',
        payload: {
          description: `Copy email ${emailId}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ emailId, targetMailboxIds }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const targetMailboxIdList = Object.keys(targetMailboxIds).filter(id => targetMailboxIds[id])

      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      // Optimistically update: add the email to destination mailbox queries
      // Note: We don't have the full email object here, so we just invalidate
      // the destination queries to trigger a refetch

      return { previousThreads, previousEmails, targetMailboxIdList, emailId }
    },
    onError: (_err, _data, context: { previousThreads?: QuerySnapshot; previousEmails?: QuerySnapshot } | undefined) => {
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (result, variables) => {
      if (isDeferredMutationResult(result)) return

      // Invalidate queries for affected mailboxes
      const targetMailboxIds = Object.keys(variables.targetMailboxIds).filter(id => variables.targetMailboxIds[id])
      targetMailboxIds.forEach(mailboxId => {
        queryClient.invalidateQueries({ queryKey: ['threads', accountId, mailboxId] })
        queryClient.invalidateQueries({ queryKey: ['emails', accountId, mailboxId] })
      })
      invalidateEmailQueries(queryClient)
      invalidateMailboxQueries(queryClient)
    },
  })
}

/**
 * Hook for bulk Email/copy - Copy multiple emails at once
 */
export function useEmailCopyBulk() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      emailIds,
      targetMailboxIds,
      fromAccountId,
      copyKeywords = false,
    }: {
      emailIds: string[]
      targetMailboxIds: Record<string, boolean>
      fromAccountId?: string
      copyKeywords?: boolean
    }) => {
      if (!accountId) {
        throw new Error('No account available for Email/copy')
      }

      const sourceAccountId = fromAccountId || accountId

      // Fetch source emails to get keywords if needed
      let emailKeywordsMap: Map<string, Record<string, boolean>> = new Map()
      if (copyKeywords) {
        const emailResponse = await jmapClient.request([
          ['Email/get', {
            accountId: sourceAccountId,
            ids: emailIds,
            properties: ['keywords'],
          }, 'get0'],
        ])
        const emailResult = asGetResponse<Email>(emailResponse.methodResponses[0][1])
        emailResult.list?.forEach(email => {
          if (email.keywords) {
            emailKeywordsMap.set(email.id, email.keywords)
          }
        })
      }

      // Build create object for all emails
      const createObj: Record<string, { id: string; mailboxIds: Record<string, boolean>; keywords?: Record<string, boolean> }> = {}
      emailIds.forEach((emailId, index) => {
        const obj: { id: string; mailboxIds: Record<string, boolean>; keywords?: Record<string, boolean> } = {
          id: emailId,
          mailboxIds: targetMailboxIds,
        }
        if (copyKeywords) {
          const keywords = emailKeywordsMap.get(emailId)
          if (keywords) {
            obj.keywords = keywords
          }
        }
        createObj[`copy-${index}-${Date.now()}`] = obj
      })

      const request: EmailCopyRequest = {
        accountId,
        fromAccountId: sourceAccountId,
        create: createObj,
      }

      const requests = [
        jmapMethodCall('Email/copy', request as unknown as Record<string, unknown>, '0'),
      ]

      return runDeferredAwareMutation({
        accountId,
        operation: 'copyEmailBulk',
        payload: {
          description: `Copy ${emailIds.length} emails`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })
    },
    onMutate: async ({ targetMailboxIds }) => {
      suppressNewMailNotification()
      await queryClient.cancelQueries({ queryKey: ['threads'] })
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] })
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] })

      return { previousThreads, previousEmails }
    },
    onError: (_err, _data, context: { previousThreads?: QuerySnapshot; previousEmails?: QuerySnapshot } | undefined) => {
      rollbackQueries(queryClient, context?.previousThreads)
      rollbackQueries(queryClient, context?.previousEmails)
    },
    onSuccess: (result, variables) => {
      if (isDeferredMutationResult(result)) return

      const targetMailboxIds = Object.keys(variables.targetMailboxIds).filter(id => variables.targetMailboxIds[id])
      targetMailboxIds.forEach(mailboxId => {
        queryClient.invalidateQueries({ queryKey: ['threads', accountId, mailboxId] })
        queryClient.invalidateQueries({ queryKey: ['emails', accountId, mailboxId] })
      })
      invalidateEmailQueries(queryClient)
      invalidateMailboxQueries(queryClient)
    },
  })
}