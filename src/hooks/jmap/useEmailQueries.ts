import { useQuery, useQueryClient } from '@tanstack/react-query'
import { jmapClient, type JMAPResponse } from '../../api/jmap'
import { fetchWithOfflineCache } from '../../utils/offlineCache'
import { logger } from '../../utils/logger'
import { suppressNewMailNotification } from './queryCacheUtils'
import { updateEmailStateFromResponse } from './useEmailMutations'
import { parseSearchQuery } from '../../utils/searchParser'
import { buildJMAPFilter, mergeFiltersAND } from '../../utils/filterBuilder'
import { chunkForGet } from '../../utils/capabilityUtils'
import { isExplicitlyMarkedUnread } from './useEmailMutations'
import type { Email, Thread, SearchSnippet, EmailFilter } from '../../types/jmap'
import type { SearchFilter } from '../../types/search'

// Type helpers for JMAP responses
interface EmailQueryResult {
  ids: string[];
}

interface EmailGetResult {
  list: Email[];
}

interface ThreadGetResult {
  list: Thread[];
}

interface SearchSnippetResult {
  list: SearchSnippet[];
}

/**
 * JMAP Error response per RFC 8620 §3.6.1
 */
interface JMAPError {
  type: string;
  description?: string;
}

/**
 * Extracts the method result from a JMAP response, checking for errors per RFC 8620 §3.6.
 * @param response - The full JMAP response object
 * @param methodIndex - Index of the method response to extract (default: 0)
 * @param methodName - Expected method name for better error messages
 * @returns The method result data
 * @throws Error if the response is a JMAP error
 */
function extractMethodResult<T>(
  response: JMAPResponse,
  methodIndex: number = 0,
  methodName?: string,
): T {
  if (!response?.methodResponses?.[methodIndex]) {
    throw new Error(`Missing method response at index ${methodIndex}`)
  }

  const [name, data] = response.methodResponses[methodIndex]
  
  if (name === 'error') {
    const error = data as JMAPError
    const context = methodName ? ` for ${methodName}` : ''
    logger.error(`JMAP error${context}:`, error)
    throw new Error(error.description || `JMAP error: ${error.type}`)
  }

  return data as T
}

/**
 * Compose the mailbox-scoped condition shared by Email/query and
 * SearchSnippet/get so both requests are filtered identically.
 */
function buildMailboxCondition(mailboxId?: string, excludeMailboxIds?: string[]): EmailFilter {
  const mailboxConditions: EmailFilter[] = []
  if (mailboxId && mailboxId !== 'all' && mailboxId !== 'flagged') {
    mailboxConditions.push({ inMailbox: mailboxId })
  }
  if (mailboxId === 'all' && excludeMailboxIds && excludeMailboxIds.length > 0) {
    mailboxConditions.push({ inMailboxOtherThan: excludeMailboxIds })
  }
  if (mailboxId === 'flagged') {
    mailboxConditions.push({ hasKeyword: '$flagged' })
  }
  return mergeFiltersAND(...mailboxConditions)
}

/**
 * Compose the search-term + dialog-filter condition (including free text)
 * into a single JMAP filter. Returns null when no constraint is active.
 * Shared by Email/query and SearchSnippet/get (BUG-2026-053).
 */
function buildEffectiveSearchFilter(searchTerm?: string, dialogFilter?: SearchFilter): EmailFilter | null {
  if (!searchTerm && !dialogFilter) return null

  const parsed = searchTerm
    ? parseSearchQuery(searchTerm)
    : { text: '', filters: {} as SearchFilter }

  // Merge dialog filters into parsed search filters at SearchFilter level
  // dialogFilter takes precedence for overlapping fields
  const mergedSearch: SearchFilter = {
    ...parsed.filters,
    ...dialogFilter,
  }
  // Concatenate headerFilters from both sources
  if (dialogFilter?.headerFilters?.length || parsed.filters.headerFilters?.length) {
    mergedSearch.headerFilters = [
      ...(parsed.filters.headerFilters || []),
      ...(dialogFilter?.headerFilters || []),
    ]
  }

  const builtFilter = buildJMAPFilter(mergedSearch)
  const textFilter: EmailFilter | null = parsed.text ? { text: parsed.text } : null

  return textFilter
    ? (Object.keys(builtFilter).length > 0 ? mergeFiltersAND(builtFilter, textFilter) : textFilter)
    : (Object.keys(builtFilter).length > 0 ? builtFilter : null)
}

export function useThreads(
  mailboxId?: string,
  searchTerm?: string,
  dialogFilter?: SearchFilter,
  excludeMailboxIds?: string[],
) {
  const accountId = jmapClient.getPrimaryAccount()

  return useQuery({
    queryKey: ['threads', accountId, mailboxId, searchTerm, dialogFilter ? JSON.stringify(dialogFilter) : undefined, excludeMailboxIds],
    queryFn: async () => fetchWithOfflineCache(['threads', accountId, mailboxId, searchTerm, dialogFilter ? JSON.stringify(dialogFilter) : undefined, excludeMailboxIds], async () => {
      if (!mailboxId && !searchTerm && !dialogFilter) return []

      const mailboxCondition = buildMailboxCondition(mailboxId, excludeMailboxIds)
      const effectiveSearchFilter = buildEffectiveSearchFilter(searchTerm, dialogFilter)

      // Combine mailbox conditions with search/dialog filter. mergeFiltersAND
      // flattens plain conditions into one valid EmailFilterCondition (RFC
      // 8621 §4.4.1 allows e.g. { inMailbox, text } together) but wraps in
      // { allOf: [...] } (RFC 8620 §5.5) the moment any operand is itself a
      // FilterOperator — never producing an invalid mix like
      // { inMailbox: 'id', allOf: [...] }.
      const filter: EmailFilter = mergeFiltersAND(mailboxCondition, ...(effectiveSearchFilter ? [effectiveSearchFilter] : []))

      const queryResponse = await jmapClient.request([
        ['Email/query', {
          accountId,
          filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          collapseThreads: true,
          limit: 100,
        }, '0'],
      ])

      const queryResult = extractMethodResult<EmailQueryResult>(queryResponse, 0, 'Email/query')
      const ids = queryResult.ids
      if (!ids || ids.length === 0) return []

      const getEmailsResponse = await jmapClient.request([
        ['Email/get', {
          accountId,
          ids,
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'subject', 'preview', 'receivedAt', 'keywords', 'hasAttachment'],
        }, '1'],
      ])

      updateEmailStateFromResponse(getEmailsResponse)
      const emailResult = extractMethodResult<EmailGetResult>(getEmailsResponse, 0, 'Email/get')
      const latestEmails = emailResult.list
      if (!latestEmails || latestEmails.length === 0) return []

      const threadIds = Array.from(new Set(latestEmails.map((email: Email) => email.threadId)))
      const threadsResponse = await jmapClient.request([
        ['Thread/get', {
          accountId,
          ids: threadIds,
        }, '2'],
      ])

      const threadResult = extractMethodResult<ThreadGetResult>(threadsResponse, 0, 'Thread/get')
      const threads = threadResult.list
      if (!threads) return latestEmails

      const emailsWithThreadCount = latestEmails.map((email: Email) => ({
        ...email,
        threadCount: threads.find((thread: Thread) => thread.id === email.threadId)?.emailIds?.length || 1,
      }))

      if (searchTerm && ids.length > 0) {
        try {
          // Reuse the exact same structural composition as the Email/query
          // above. Hand-flattening conditions with Object.assign previously
          // clobbered duplicate singular keys (two `header:` or two keyword
          // filters), desynchronizing snippet highlighting from the result
          // set (BUG-2026-053).
          const snippetSearchFilter = buildEffectiveSearchFilter(searchTerm, dialogFilter)
          let snippetFilter: EmailFilter = mergeFiltersAND(
            buildMailboxCondition(mailboxId, excludeMailboxIds),
            ...(snippetSearchFilter ? [snippetSearchFilter] : []),
          )
          if (Object.keys(snippetFilter).length === 0) {
            snippetFilter = { text: searchTerm }
          }

          const snippetResponse = await jmapClient.request([
            ['SearchSnippet/get', {
              accountId,
              filter: snippetFilter,
              emailIds: ids,
            }, '3'],
          ])

          const snippetResult = extractMethodResult<SearchSnippetResult>(snippetResponse, 0, 'SearchSnippet/get')
          const snippets = snippetResult.list
          if (snippets && snippets.length > 0) {
            const snippetMap = new Map(snippets.map((snippet: SearchSnippet) => [snippet.emailId, snippet]))
            return emailsWithThreadCount.map((email: Email & { threadCount: number }) => {
              const snippet = snippetMap.get(email.id)
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
    // CRITICAL FIX: Always treat as stale when filters/search change
    // This ensures React Query refetches when query key changes
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // Keep in garbage collector for 5 minutes
    refetchOnWindowFocus: false, // Don't auto-refetch on focus (prevents jarring UI updates)
  })
}

import type { QueryClient } from '@tanstack/react-query'

async function fetchEmailDetail(accountId: string, emailId: string, threadId?: string, queryClient?: QueryClient): Promise<Email[]> {
  return fetchWithOfflineCache(['emailDetail', accountId, emailId, threadId ?? null], async () => {
    const idsToFetch = [emailId]

    if (threadId) {
      const threadResponse = await jmapClient.request([
        ['Thread/get', {
          accountId,
          ids: [threadId],
        }, '0'],
      ])
      const threadResult = extractMethodResult<ThreadGetResult>(threadResponse, 0, 'Thread/get')
      const threadEmailIds = threadResult.list[0]?.emailIds
      if (threadEmailIds) {
        idsToFetch.push(...threadEmailIds.filter((id: string) => id !== emailId))
      }
    }

    // Chunk the ID list so a single Email/get never exceeds the server's
    // maxObjectsInGet limit when a thread contains thousands of emails.
    const chunks = chunkForGet(idsToFetch)
    const allFetched: Email[] = []
    for (const chunk of chunks) {
      const response = await jmapClient.request([
        ['Email/get', {
          accountId,
          ids: chunk,
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'to', 'cc', 'bcc', 'subject', 'bodyValues', 'textBody', 'htmlBody', 'receivedAt', 'keywords', 'hasAttachment', 'attachments', 'bodyStructure', 'blobId', 'header:Disposition-Notification-To:asText'],
          fetchAllBodyValues: true,
        }, '1'],
      ])

      updateEmailStateFromResponse(response)
      const emailResult = extractMethodResult<EmailGetResult>(response, 0, 'Email/get')
      if (emailResult.list) allFetched.push(...emailResult.list)
    }
    const list = allFetched
    if (list.length === 0) return []

    const emails = list.sort((a: Email, b: Email) =>
      new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
    )

    const selectedEmail = emails.find((email: Email) => email.id === emailId)
    if (selectedEmail && (!selectedEmail.keywords || !selectedEmail.keywords['$seen'])) {
      // Skip auto-read only when the USER explicitly marked this email as
      // unread. The $seen cache value is unreliable here: a freshly-fetched
      // unread email also has $seen: false, which previously made auto-read
      // silently never fire until some manual action occurred.
      if (!isExplicitlyMarkedUnread(emailId)) {
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
        ]).then((resp) => {
          updateEmailStateFromResponse(resp)
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ['threads'] })
            queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
          }
        }).catch((err) => {
          logger.warn('Failed to mark email as read:', err)
        })
      }
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

export async function fetchEmailWithBody(emailId: string): Promise<Email | null> {
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

    updateEmailStateFromResponse(response)
    const emailResult = extractMethodResult<EmailGetResult>(response, 0, 'Email/get')
    return emailResult.list?.[0] || null
  })
}
