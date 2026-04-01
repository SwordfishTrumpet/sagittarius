import { useQuery, useQueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { fetchWithOfflineCache } from '../../utils/offlineCache'
import { logger } from '../../utils/logger'
import { suppressNewMailNotification } from './queryCacheUtils'

export function useEmails(mailboxId?: string, searchTerm?: string) {
  const accountId = jmapClient.getPrimaryAccount()

  return useQuery({
    queryKey: ['emails', accountId, mailboxId, searchTerm],
    queryFn: async () => fetchWithOfflineCache(['emails', accountId, mailboxId, searchTerm], async () => {
      if (!mailboxId && !searchTerm) return []

      const filter: any = {}
      if (mailboxId) filter.inMailbox = mailboxId
      if (searchTerm) filter.text = searchTerm

      const queryResponse = await jmapClient.request([
        ['Email/query', {
          accountId,
          filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 50,
        }, '0'],
      ])

      const ids = queryResponse.methodResponses[0][1].ids
      if (!ids.length) return []

      const getResponse = await jmapClient.request([
        ['Email/get', {
          accountId,
          ids,
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'subject', 'preview', 'receivedAt', 'keywords', 'hasAttachment'],
        }, '1'],
      ])

      return getResponse.methodResponses[0][1].list
    }),
    enabled: !!accountId && !!mailboxId,
  })
}

export function useThreads(mailboxId?: string, searchTerm?: string, quickFilters?: Record<string, any>) {
  const accountId = jmapClient.getPrimaryAccount()

  return useQuery({
    queryKey: ['threads', accountId, mailboxId, searchTerm, quickFilters ? JSON.stringify(quickFilters) : undefined],
    queryFn: async () => fetchWithOfflineCache(['threads', accountId, mailboxId, searchTerm, quickFilters ? JSON.stringify(quickFilters) : undefined], async () => {
      if (!mailboxId && !searchTerm) return []

      const mailboxConditions: any[] = []
      if (mailboxId && mailboxId !== 'all' && mailboxId !== 'flagged') {
        mailboxConditions.push({ inMailbox: mailboxId })
      }
      if (mailboxId === 'flagged') {
        mailboxConditions.push({ hasKeyword: '$flagged' })
      }

      let searchFilter: any = null
      if (searchTerm) {
        searchFilter = {
          anyOf: [
            { from: searchTerm },
            { to: searchTerm },
            { subject: searchTerm },
            { text: searchTerm },
          ],
        }
      }

      const allConditions = [...mailboxConditions, ...(searchFilter ? [searchFilter] : [])]
      const baseFilter = allConditions.length === 0
        ? null
        : allConditions.length === 1
          ? allConditions[0]
          : { allOf: allConditions }

      let filter: any
      if (quickFilters && Object.keys(quickFilters).length > 0) {
        const quickConditions = quickFilters.allOf || [quickFilters]
        if (baseFilter) {
          filter = { allOf: [baseFilter, ...quickConditions] }
        } else {
          filter = quickConditions.length === 1 ? quickConditions[0] : { allOf: quickConditions }
        }
      } else {
        filter = baseFilter || {}
      }

      const queryResponse = await jmapClient.request([
        ['Email/query', {
          accountId,
          filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          collapseThreads: true,
          limit: 100,
        }, '0'],
      ])

      const ids = queryResponse.methodResponses[0][1].ids
      if (!ids || ids.length === 0) return []

      const getEmailsResponse = await jmapClient.request([
        ['Email/get', {
          accountId,
          ids,
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'subject', 'preview', 'receivedAt', 'keywords', 'hasAttachment'],
        }, '1'],
      ])

      const latestEmails = getEmailsResponse.methodResponses[0][1].list
      if (!latestEmails || latestEmails.length === 0) return []

      const threadIds = Array.from(new Set(latestEmails.map((email: any) => email.threadId)))
      const threadsResponse = await jmapClient.request([
        ['Thread/get', {
          accountId,
          ids: threadIds,
        }, '2'],
      ])

      const threads = threadsResponse.methodResponses[0][1].list
      if (!threads) return latestEmails

      const emailsWithThreadCount = latestEmails.map((email: any) => ({
        ...email,
        threadCount: threads.find((thread: any) => thread.id === email.threadId)?.emailIds?.length || 1,
      }))

      if (searchTerm && ids.length > 0) {
        try {
          const snippetFilter: any = {}
          if (mailboxId && mailboxId !== 'all' && mailboxId !== 'flagged') {
            snippetFilter.inMailbox = mailboxId
          }
          if (mailboxId === 'flagged') {
            snippetFilter.hasKeyword = '$flagged'
          }
          snippetFilter.text = searchTerm

          const snippetResponse = await jmapClient.request([
            ['SearchSnippet/get', {
              accountId,
              filter: snippetFilter,
              emailIds: ids,
            }, '3'],
          ])

          const snippets = snippetResponse.methodResponses[0][1]?.list
          if (snippets && snippets.length > 0) {
            const snippetMap = new Map(snippets.map((snippet: any) => [snippet.emailId, snippet]))
            return emailsWithThreadCount.map((email: any) => {
              const snippet = snippetMap.get(email.id) as any
              return snippet ? { ...email, searchSnippet: snippet.preview || snippet.subject } : email
            })
          }
        } catch (err) {
          logger.warn('SearchSnippet/get failed (may not be supported):', err)
        }
      }

      return emailsWithThreadCount
    }),
    enabled: !!accountId && (!!mailboxId || !!searchTerm),
  })
}

async function fetchEmailDetail(accountId: string, emailId: string, threadId?: string, queryClient?: any) {
  return fetchWithOfflineCache(['emailDetail', accountId, emailId, threadId ?? null], async () => {
    const idsToFetch = [emailId]

    if (threadId) {
      const threadResponse = await jmapClient.request([
        ['Thread/get', {
          accountId,
          ids: [threadId],
        }, '0'],
      ])
      const threadEmailIds = threadResponse.methodResponses[0][1].list[0]?.emailIds
      if (threadEmailIds) {
        idsToFetch.push(...threadEmailIds.filter((id: string) => id !== emailId))
      }
    }

    const response = await jmapClient.request([
      ['Email/get', {
        accountId,
        ids: idsToFetch,
        properties: ['id', 'threadId', 'mailboxIds', 'from', 'to', 'cc', 'bcc', 'subject', 'bodyValues', 'textBody', 'htmlBody', 'receivedAt', 'keywords', 'hasAttachment', 'attachments', 'bodyStructure', 'blobId', 'header:Disposition-Notification-To:asText'],
        fetchAllBodyValues: true,
      }, '1'],
    ])

    const list = response.methodResponses[0][1].list
    if (!list) return []

    const emails = list.sort((a: any, b: any) =>
      new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
    )

    const selectedEmail = emails.find((email: any) => email.id === emailId)
    if (selectedEmail && (!selectedEmail.keywords || !selectedEmail.keywords['$seen'])) {
      suppressNewMailNotification()
      jmapClient.request([
        ['Email/set', {
          accountId,
          update: {
            [emailId]: {
              'keywords/$seen': true,
            },
          },
        }, '0'],
      ]).then(() => {
        if (queryClient) {
          queryClient.invalidateQueries({ queryKey: ['threads'] })
          queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
        }
      })
    }

    return emails
  })
}

export function useEmailDetail(emailId?: string, threadId?: string) {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['emailDetail', accountId, emailId, threadId],
    queryFn: () => fetchEmailDetail(accountId!, emailId!, threadId, queryClient),
    enabled: !!accountId && !!emailId,
  })
}

export async function fetchEmailWithBody(emailId: string): Promise<any | null> {
  const accountId = jmapClient.getPrimaryAccount()
  if (!accountId) return null
  return fetchWithOfflineCache(['emailWithBody', accountId, emailId], async () => {
    const response = await jmapClient.request([
      ['Email/get', {
        accountId,
        ids: [emailId],
        properties: ['id', 'threadId', 'mailboxIds', 'from', 'to', 'cc', 'bcc', 'subject', 'bodyValues', 'textBody', 'htmlBody', 'receivedAt', 'keywords', 'hasAttachment', 'attachments', 'bodyStructure', 'blobId', 'header:Disposition-Notification-To:asText'],
        fetchAllBodyValues: true,
      }, '0'],
    ])

    const list = response.methodResponses[0][1].list
    return list?.[0] || null
  })
}
