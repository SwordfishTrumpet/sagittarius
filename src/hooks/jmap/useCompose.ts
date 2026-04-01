import { useMutation, useQueryClient } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { isDeferredMutationResult, runDeferredAwareMutation } from '../../utils/offlineSyncQueue'
import {
  invalidateEmailQueries,
  jmapMethodCall,
  jmapRequest,
  suppressNewMailNotification,
} from './queryCacheUtils'

export function useCompose() {
  const accountId = jmapClient.getPrimaryAccount()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ to, cc, bcc, subject, body, attachments, identityId, fromEmail, sendAt }: {
      to: { name?: string, email: string }[],
      cc?: { name?: string, email: string }[],
      bcc?: { name?: string, email: string }[],
      subject: string,
      body: string,
      attachments?: { blobId: string, name: string, type: string, size: number }[],
      identityId: string,
      fromEmail: string,
      sendAt?: string,
    }) => {
      const mailboxesRes = await jmapClient.request([
        ['Mailbox/get', { accountId, ids: null }, '0'],
      ])
      const draftBox = mailboxesRes.methodResponses[0][1].list.find((mailbox: any) => mailbox.role === 'drafts')
      const sentBox = mailboxesRes.methodResponses[0][1].list.find((mailbox: any) => mailbox.role === 'sent')

      if (!draftBox || !sentBox) throw new Error('Could not find Drafts or Sent mailbox')

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
            ...attachments.map(attachment => ({
              blobId: attachment.blobId,
              type: attachment.type || 'application/octet-stream',
              name: attachment.name,
              disposition: 'attachment',
            })),
          ],
        }
      } else {
        draftEmail[bodyPartKey] = [{ partId: 'body-1', type: bodyPartType }]
      }

      const requests = [
        jmapMethodCall('Email/set', {
          accountId,
          create: {
            'draft-1': draftEmail,
          },
        }, '0'),
        jmapMethodCall('EmailSubmission/set', {
          accountId,
          create: {
            'send-1': {
              emailId: '#draft-1',
              identityId,
              ...(sendAt ? { sendAt } : {}),
            },
          },
          onSuccessUpdateEmail: {
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

      for (const [method, result] of (response as any).methodResponses) {
        if (method === 'error') {
          throw new Error(`JMAP error: ${result.type} — ${result.description || 'Unknown error'}`)
        }
        if (result.notCreated) {
          const firstError = Object.values(result.notCreated)[0] as any
          throw new Error(`Failed to create: ${firstError?.type || 'Unknown error'}`)
        }
      }

      return response as any
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
