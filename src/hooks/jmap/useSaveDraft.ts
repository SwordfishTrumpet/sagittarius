import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { isDeferredMutationResult, runDeferredAwareMutation } from '../../utils/offlineSyncQueue'
import { buildEmailBody } from '../../utils/buildEmailBody'
import {
  invalidateEmailQueries,
  jmapMethodCall,
  jmapRequest,
  suppressNewMailNotification,
} from './queryCacheUtils'
import type { Mailbox } from '../../types/jmap'

// Type helper for mailbox list response
interface MailboxGetResult {
  list: Mailbox[];
}

function asMailboxGet(data: unknown): MailboxGetResult {
  return data as MailboxGetResult;
}

// Type guards for JMAP response validation
interface JMAPError {
  type: string
  description?: string
}

interface JMAPMethodResult {
  created?: Record<string, { id: string }>
  notCreated?: Record<string, JMAPError>
  notUpdated?: Record<string, JMAPError>
}

interface JMAPResponse {
  methodResponses: Array<[string, JMAPMethodResult | JMAPError, string]>
}

function isJMAPResponse(response: unknown): response is JMAPResponse {
  return Boolean(
    response &&
    typeof response === 'object' &&
    'methodResponses' in response &&
    Array.isArray((response as JMAPResponse).methodResponses)
  )
}

interface SaveDraftParams {
  to?: { name?: string; email: string }[]
  cc?: { name?: string; email: string }[]
  bcc?: { name?: string; email: string }[]
  subject?: string
  body?: string
  attachments?: { blobId: string; name: string; type: string; size: number }[]
  fromEmail: string
  draftId?: string
}

/**
 * Hook for saving drafts to the JMAP server (Drafts mailbox).
 * Unlike useCompose which sends emails, this only creates/updates draft emails.
 */
export function useSaveDraft() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      to = [],
      cc = [],
      bcc = [],
      subject = '',
      body = '',
      attachments,
      fromEmail,
      draftId,
    }: SaveDraftParams) => {
      const mailboxesRes = await jmapClient.request([
        ['Mailbox/get', { accountId, ids: null }, '0'],
      ])
      // Check for JMAP error before accessing data
      if (mailboxesRes.methodResponses[0][0] === 'error') {
        const errorData = mailboxesRes.methodResponses[0][1] as { type?: string; description?: string }
        throw new Error(`Failed to fetch mailboxes: ${errorData.type || 'Unknown error'}`)
      }
      const mailboxResult = asMailboxGet(mailboxesRes.methodResponses[0][1])
      const draftBox = mailboxResult.list.find(
        (mailbox) => mailbox.role === 'drafts'
      )

      if (!draftBox) throw new Error('Could not find Drafts mailbox')

      const bodyStructure = buildEmailBody(body, attachments, draftId)
      const draftEmail: Record<string, unknown> = {
        mailboxIds: { [draftBox.id]: true },
        from: [{ name: null, email: fromEmail }],
        to,
        cc,
        bcc,
        subject,
        keywords: { '$draft': true },
        ...bodyStructure,
      }

      const requests = [
        jmapMethodCall(
          'Email/set',
          {
            accountId,
            ...(draftId
              ? {
                  update: {
                    [draftId]: draftEmail,
                  },
                }
              : {
                  create: {
                    'draft-1': draftEmail,
                  },
                }),
          },
          '0'
        ),
      ]

      const response = await runDeferredAwareMutation({
        accountId,
        operation: 'saveDraft',
        payload: {
          description: `Save draft from ${fromEmail}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })

      if (isDeferredMutationResult(response)) {
        return { ...response, draftId }
      }

      // Validate response structure
      if (!isJMAPResponse(response)) {
        throw new Error('Invalid JMAP response: missing methodResponses')
      }

      // Extract created email ID for new drafts
      let newDraftId = draftId
      if (!draftId) {
        for (const [method, result] of response.methodResponses) {
          const methodResult = result as JMAPMethodResult
          if (method === 'Email/set' && methodResult.created?.['draft-1']) {
            newDraftId = methodResult.created['draft-1'].id
          }
        }
      }

      for (const [method, result] of response.methodResponses) {
        if (method === 'error') {
          const errorResult = result as JMAPError
          throw new Error(`JMAP error: ${errorResult.type} — ${errorResult.description || 'Unknown error'}`)
        }
        const methodResult = result as JMAPMethodResult
        if (methodResult.notCreated && Object.keys(methodResult.notCreated).length > 0) {
          const firstError = Object.values(methodResult.notCreated)[0] as JMAPError
          throw new Error(`Failed to create draft: ${firstError?.type || 'Unknown error'}`)
        }
        if (methodResult.notUpdated && Object.keys(methodResult.notUpdated).length > 0) {
          const firstError = Object.values(methodResult.notUpdated)[0] as JMAPError
          throw new Error(`Failed to update draft: ${firstError?.type || 'Unknown error'}`)
        }
      }

      return { ...response, draftId: newDraftId }
    },
    onMutate: () => {
      suppressNewMailNotification()
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      invalidateEmailQueries(queryClient)
    },
  })
}
