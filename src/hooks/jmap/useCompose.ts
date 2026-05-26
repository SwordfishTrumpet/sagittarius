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
import { updateEmailStateFromResponse } from './useEmailMutations'
import { asMailboxGet, type Mailbox } from '../../types/jmap'

export function useCompose() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ to, cc, bcc, subject, body, attachments, identityId, fromEmail, sendAt, draftId }: {
      to: { name?: string, email: string }[],
      cc?: { name?: string, email: string }[],
      bcc?: { name?: string, email: string }[],
      subject: string,
      body: string,
      attachments?: { blobId: string, name: string, type: string, size: number }[],
      identityId: string,
      fromEmail: string,
      sendAt?: string,
      draftId?: string,
    }) => {
      const mailboxesRes = await jmapClient.request([
        ['Mailbox/get', { accountId, ids: null }, '0'],
      ])
      // Check for JMAP error before accessing data
      if (mailboxesRes.methodResponses[0][0] === 'error') {
        const errorData = mailboxesRes.methodResponses[0][1] as { type?: string; description?: string }
        throw new Error(`Failed to fetch mailboxes: ${errorData.type || 'Unknown error'}`)
      }
      const mailboxResult = asMailboxGet(mailboxesRes.methodResponses[0][1])
      const draftBox = mailboxResult.list.find((mailbox) => mailbox.role === 'drafts')
      const sentBox = mailboxResult.list.find((mailbox) => mailbox.role === 'sent')

      if (!draftBox || !sentBox) throw new Error('Could not find Drafts or Sent mailbox')

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

      const emailIdReference = draftId || '#draft-1'
      const requests = [
        jmapMethodCall('Email/set', {
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
        }, '0'),
        jmapMethodCall('EmailSubmission/set', {
          accountId,
          create: {
            'send-1': {
              emailId: emailIdReference,
              identityId,
              ...(sendAt ? { sendAt } : {}),
            },
          },
          // Per RFC 8621 Section 7.5: When sendAt is specified, the email is queued
          // for later delivery. onSuccessUpdateEmail should NOT be applied immediately
          // for scheduled sends - the email should stay in Drafts until send time.
          onSuccessUpdateEmail: sendAt ? undefined : {
            '#send-1': {
              [`mailboxIds/${draftBox.id}`]: null,
              [`mailboxIds/${sentBox.id}`]: true,
              'keywords/$draft': null,
              'keywords/$seen': true,
            },
          },
        }, '1'),
      ]

      const response = await runDeferredAwareMutation({
        accountId,
        operation: 'composeSend',
        payload: {
          description: sendAt ? `Schedule message from ${fromEmail}` : `Send message from ${fromEmail}`,
          requests,
        },
        execute: () => jmapRequest(requests),
      })

      if (isDeferredMutationResult(response)) {
        return response
      }

      // Type guards for JMAP response validation
      interface JMAPError {
        type: string
        description?: string
        properties?: string[]
      }
      
      interface JMAPMethodResult {
        notCreated?: Record<string, JMAPError>
        notUpdated?: Record<string, JMAPError>
      }
      
      interface JMAPResponse {
        methodResponses: Array<[string, JMAPMethodResult | JMAPError, string]>
      }
      
      // Validate response structure
      if (!response || typeof response !== 'object' || !Array.isArray((response as JMAPResponse).methodResponses)) {
        throw new Error('Invalid JMAP response: missing methodResponses')
      }
      
      const jmapResponse = response as JMAPResponse

      for (const [method, result] of jmapResponse.methodResponses) {
        if (method === 'error') {
          const errorResult = result as JMAPError
          throw new Error(`JMAP error: ${errorResult.type} — ${errorResult.description || 'Unknown error'}`)
        }
        
        const methodResult = result as JMAPMethodResult
        if (methodResult.notCreated && Object.keys(methodResult.notCreated).length > 0) {
          const firstError = Object.values(methodResult.notCreated)[0] as JMAPError
          const props = firstError.properties?.length ? ` (properties: ${firstError.properties.join(', ')})` : ''
          throw new Error(`Failed to create: ${firstError.type}${props}${firstError.description ? ` — ${firstError.description}` : ''}`)
        }
        // Check for notUpdated errors from onSuccessUpdateEmail patch
        if (methodResult.notUpdated && Object.keys(methodResult.notUpdated).length > 0) {
          const firstError = Object.values(methodResult.notUpdated)[0] as JMAPError
          const props = firstError.properties?.length ? ` (properties: ${firstError.properties.join(', ')})` : ''
          throw new Error(`Failed to move email to Sent: ${firstError.type}${props}${firstError.description ? ` — ${firstError.description}` : ''}`)
        }
      }

      return jmapResponse
    },
    onMutate: () => {
      suppressNewMailNotification()
    },
    onSuccess: (result) => {
      if (isDeferredMutationResult(result)) return
      updateEmailStateFromResponse(result)
      invalidateEmailQueries(queryClient)
    },
  })
}
