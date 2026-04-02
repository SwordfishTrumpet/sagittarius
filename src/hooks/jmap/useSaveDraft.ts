import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { isDeferredMutationResult, runDeferredAwareMutation } from '../../utils/offlineSyncQueue'
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

      const bodyPartType = body.includes('<') ? 'text/html' : 'text/plain'
      const bodyPartKey = bodyPartType === 'text/html' ? 'htmlBody' : 'textBody'
      
      const draftEmail: Record<string, any> = {
        mailboxIds: { [draftBox.id]: true },
        from: [{ name: null, email: fromEmail }],
        to,
        cc,
        bcc,
        subject,
        bodyValues: {
          'body-1': {
            value: body,
            isTruncated: false,
          },
        },
        keywords: { '$draft': true },
      }

      if (attachments?.length) {
        draftEmail.bodyStructure = {
          type: 'multipart/mixed',
          subParts: [
            { partId: 'body-1', type: bodyPartType },
            ...attachments.map((attachment) => ({
              blobId: attachment.blobId,
              type: attachment.type || 'application/octet-stream',
              name: attachment.name,
              disposition: 'attachment',
            })),
          ],
        }
        if (draftId) {
          draftEmail.textBody = null
          draftEmail.htmlBody = null
        }
      } else {
        draftEmail[bodyPartKey] = [{ partId: 'body-1', type: bodyPartType }]
        if (draftId) {
          draftEmail.bodyStructure = null
          draftEmail[bodyPartType === 'text/html' ? 'textBody' : 'htmlBody'] = null
        }
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

      // Extract created email ID for new drafts
      let newDraftId = draftId
      if (!draftId) {
        for (const [method, result] of (response as any).methodResponses) {
          if (method === 'Email/set' && result.created?.['draft-1']) {
            newDraftId = result.created['draft-1'].id
          }
        }
      }

      for (const [method, result] of (response as any).methodResponses) {
        if (method === 'error') {
          throw new Error(`JMAP error: ${result.type} — ${result.description || 'Unknown error'}`)
        }
        if (result.notCreated) {
          const firstError = Object.values(result.notCreated)[0] as any
          throw new Error(`Failed to create draft: ${firstError?.type || 'Unknown error'}`)
        }
        if (result.notUpdated) {
          const firstError = Object.values(result.notUpdated)[0] as any
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
