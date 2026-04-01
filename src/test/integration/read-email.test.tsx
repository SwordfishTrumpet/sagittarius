import { waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeEmailDetail, makeEmailList, makeIdentityList, makeMailboxList, makeSession, makeThreadList, wrapMethodResponse } from '../fixtures/jmap'
import { getJmapRequestBodies, jsonResponse, renderApp, respondWith, storeAuthenticatedSession } from './helpers'

describe('read email flow', () => {
  it('loads the inbox, opens a thread, and marks the selected email as read', async () => {
    const session = makeSession()
    const mailboxes = makeMailboxList()
    const identities = makeIdentityList()
    const inboxEmails = makeEmailList('mailbox-inbox', 3, [
      {
        id: 'email-1',
        threadId: 'thread-1',
        from: [{ name: 'Alice Example', email: 'alice@example.com' }],
        subject: 'Quarterly update',
        preview: 'Body preview for the first message',
        hasAttachment: true,
        keywords: {},
      },
      {
        id: 'email-2',
        threadId: 'thread-2',
        from: [{ name: 'Bob Example', email: 'bob@example.com' }],
        subject: 'Planning notes',
      },
      {
        id: 'email-3',
        threadId: 'thread-3',
        from: [{ name: 'Carol Example', email: 'carol@example.com' }],
        subject: 'FYI',
      },
    ])

    const firstMessage = makeEmailDetail('email-1', {
      threadId: 'thread-1',
      subject: 'Quarterly update',
      from: [{ name: 'Alice Example', email: 'alice@example.com' }],
      bodyValues: {
        'body-1': {
          value: '<p>Hello from Alice.</p>',
          isTruncated: false,
        },
      },
      attachments: [
        {
          blobId: 'blob-attachment-1',
          name: 'agenda.pdf',
          type: 'application/pdf',
          size: 1024,
        },
      ],
      hasAttachment: true,
      receivedAt: '2025-01-01T09:00:00.000Z',
    }).email

    const secondMessage = makeEmailDetail('email-1-reply', {
      threadId: 'thread-1',
      subject: 'Re: Quarterly update',
      from: [{ name: 'User Example', email: 'user@example.com' }],
      bodyValues: {
        'body-1': {
          value: '<p>Thanks, looks good.</p>',
          isTruncated: false,
        },
      },
      receivedAt: '2025-01-01T10:00:00.000Z',
    }).email

    storeAuthenticatedSession(session)
    respondWith([
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-query-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', inboxEmails.get)], sessionState: 'threads-get-state' }, { methodCalls: ['Email/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(inboxEmails.emails))], sessionState: 'threads-state' }, { methodCalls: ['Thread/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList([firstMessage, secondMessage]))], sessionState: 'detail-thread-state' }, { methodCalls: ['Thread/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', { accountId: 'account-001', state: 'detail-email-state', list: [firstMessage, secondMessage], notFound: [] })], sessionState: 'detail-email-state' }, { methodCalls: ['Email/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/set', { accountId: 'account-001', oldState: 'old', newState: 'new' })], sessionState: 'email-set-state' }, { methodCalls: ['Email/set'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'post-read-query-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'post-read-mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', inboxEmails.get)], sessionState: 'post-read-get-state' }, { methodCalls: ['Email/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(inboxEmails.emails))], sessionState: 'post-read-thread-state' }, { methodCalls: ['Thread/get'] }),
    ])

    const { user, screen } = renderApp()

    const quarterlyMessage = await screen.findByRole('option', { name: /Quarterly update/ })
    expect(quarterlyMessage).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Planning notes/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /FYI/ })).toBeInTheDocument()

    await user.click(within(quarterlyMessage).getByText('Quarterly update'))

    expect(await screen.findByText('Hello from Alice.')).toBeInTheDocument()
    expect(await screen.findByText('Thanks, looks good.')).toBeInTheDocument()
    expect(screen.getByText('1 Attachment')).toBeInTheDocument()
    expect(screen.getByText('<alice@example.com>')).toBeInTheDocument()

    await waitFor(() => {
      const emailSetBodies = getJmapRequestBodies(['Email/set'])
      expect(emailSetBodies).toHaveLength(1)
      expect(emailSetBodies[0].methodCalls[0][1].update).toEqual({
        'email-1': {
          'keywords/$seen': true,
        },
      })
    })
  })
})
