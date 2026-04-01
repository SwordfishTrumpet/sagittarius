import { waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeEmailList, makeIdentityList, makeMailboxList, makeSession, makeSubmissionSuccess, wrapMethodResponse } from '../fixtures/jmap'
import { getFetchCalls, jsonResponse, renderApp, respondWith, storeAuthenticatedSession } from './helpers'

vi.mock('../../components/Composer', async () => {
  const React = await import('react')
  const { useCompose } = await import('../../hooks/jmap/useCompose')
  const { useIdentities } = await import('../../hooks/jmap/useIdentities')

  return {
    Composer: ({ onClose }: { onClose: () => void }) => {
      const [to, setTo] = React.useState('')
      const [subject, setSubject] = React.useState('')
      const [body, setBody] = React.useState('')
      const compose = useCompose()
      const { data: identities } = useIdentities()
      const identity = identities?.[0]

      return (
        <div role="dialog" aria-label="Compose dialog">
          <input aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
          <input aria-label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <textarea aria-label="Message body" value={body} onChange={(event) => setBody(event.target.value)} />
          <button
            disabled={!to || !identity || compose.isPending}
            onClick={() => {
              compose.mutate({
                to: [{ email: to }],
                subject,
                body,
                identityId: identity?.id || '',
                fromEmail: identity?.email || '',
              }, {
                onSuccess: onClose,
              })
            }}
          >
            Send
          </button>
          <button
            disabled={!to || !identity || compose.isPending}
            onClick={() => {
              compose.mutate({
                to: [{ email: to }],
                subject,
                body,
                attachments: [{ blobId: 'blob-123', name: 'agenda.pdf', type: 'application/pdf', size: 1024 }],
                identityId: identity?.id || '',
                fromEmail: identity?.email || '',
                sendAt: '2026-04-01T10:00:00.000Z',
              }, {
                onSuccess: onClose,
              })
            }}
          >
            Schedule with attachment
          </button>
        </div>
      )
    },
  }
})

describe('compose send flow', () => {
  it('opens the composer, sends a message, and closes on success', async () => {
    const session = makeSession()
    const mailboxes = makeMailboxList()
    const identities = makeIdentityList()
    const inboxEmails = makeEmailList('mailbox-inbox', 0)
    const submission = makeSubmissionSuccess()

    storeAuthenticatedSession(session)
    respondWith([
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'compose-mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/set', submission.emailSet), wrapMethodResponse('EmailSubmission/set', submission.submissionSet, '1')], sessionState: 'submission-state' }, { methodCalls: ['Email/set', 'EmailSubmission/set'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'post-send-threads-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'post-send-mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
    ])

    const { user, screen } = renderApp()

    await screen.findByText('Inbox')
    await user.click(screen.getAllByRole('button')[1])

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('To'), 'friend@example.com')
    await user.type(within(dialog).getByLabelText('Subject'), 'Integration test send')
    await user.type(within(dialog).getByLabelText('Message body'), 'Hello from the compose test')
    await user.click(within(dialog).getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      const composeCall = getFetchCalls()
        .map((call) => call.body)
        .find((body) => body?.methodCalls?.[1]?.[0] === 'EmailSubmission/set')

      expect(composeCall).toBeTruthy()
      const [emailSetCall, submissionCall] = composeCall.methodCalls

      expect(emailSetCall[1].create['draft-1']).toMatchObject({
        mailboxIds: { 'mailbox-drafts': true },
        to: [{ email: 'friend@example.com' }],
        subject: 'Integration test send',
        bodyValues: {
          'body-1': {
            value: 'Hello from the compose test',
            isTruncated: false,
          },
        },
        textBody: [{ partId: 'body-1', type: 'text/plain' }],
        keywords: { '$draft': true },
      })

      expect(submissionCall[1].create['send-1']).toMatchObject({
        emailId: '#draft-1',
        identityId: 'identity-001',
      })
      expect(submissionCall[1].onSuccessUpdateEmail['#send-1']).toEqual({
        'mailboxIds/mailbox-drafts': null,
        'mailboxIds/mailbox-sent': true,
        'keywords/$draft': null,
        'keywords/$seen': true,
      })
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('keeps the composer open when sending fails', async () => {
    const session = makeSession()
    const mailboxes = makeMailboxList()
    const identities = makeIdentityList()
    const inboxEmails = makeEmailList('mailbox-inbox', 0)

    storeAuthenticatedSession(session)
    respondWith([
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [['error', { type: 'serverFail', description: 'Submission failed' }, '0']], sessionState: 'submission-error-state' }, { methodCalls: ['Email/set', 'EmailSubmission/set'] }),
    ])

    const { user, screen } = renderApp()

    await screen.findByText('Inbox')
    await user.click(screen.getAllByRole('button')[1])
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('To'), 'friend@example.com')
    await user.type(within(dialog).getByLabelText('Subject'), 'Broken send')
    await user.type(within(dialog).getByLabelText('Message body'), 'This should fail')
    await user.click(within(dialog).getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('uses bodyStructure for scheduled sends with attachments', async () => {
    const session = makeSession()
    const mailboxes = makeMailboxList()
    const identities = makeIdentityList()
    const inboxEmails = makeEmailList('mailbox-inbox', 0)
    const submission = makeSubmissionSuccess()

    storeAuthenticatedSession(session)
    respondWith([
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'compose-mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/set', submission.emailSet), wrapMethodResponse('EmailSubmission/set', submission.submissionSet, '1')], sessionState: 'submission-state' }, { methodCalls: ['Email/set', 'EmailSubmission/set'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'post-send-threads-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'post-send-mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
    ])

    const { user, screen } = renderApp()

    await screen.findByText('Inbox')
    await user.click(screen.getAllByRole('button')[1])

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('To'), 'friend@example.com')
    await user.type(within(dialog).getByLabelText('Subject'), 'Scheduled attachment test')
    await user.type(within(dialog).getByLabelText('Message body'), 'Hello with attachment')
    await user.click(within(dialog).getByRole('button', { name: 'Schedule with attachment' }))

    await waitFor(() => {
      const composeCall = getFetchCalls()
        .map((call) => call.body)
        .find((body) => body?.methodCalls?.[1]?.[0] === 'EmailSubmission/set')

      expect(composeCall).toBeTruthy()
      const [emailSetCall, submissionCall] = composeCall.methodCalls
      const createdEmail = emailSetCall[1].create['draft-1']

      expect(createdEmail.attachments).toBeUndefined()
      expect(createdEmail.textBody).toBeUndefined()
      expect(createdEmail.bodyStructure).toEqual({
        type: 'multipart/mixed',
        subParts: [
          { partId: 'body-1', type: 'text/plain' },
          {
            blobId: 'blob-123',
            type: 'application/pdf',
            name: 'agenda.pdf',
            disposition: 'attachment',
          },
        ],
      })
      expect(submissionCall[1].create['send-1']).toMatchObject({
        emailId: '#draft-1',
        identityId: 'identity-001',
        sendAt: '2026-04-01T10:00:00.000Z',
      })
      expect(submissionCall[1].onSuccessUpdateEmail['#send-1']).toEqual({
        'mailboxIds/mailbox-drafts': null,
        'mailboxIds/mailbox-sent': true,
        'keywords/$draft': null,
        'keywords/$seen': true,
      })
    })
  })
})
