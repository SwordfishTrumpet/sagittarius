import { describe, expect, it } from 'vitest'
import { makeEmailDetail, makeEmailList, makeIdentityList, makeMailboxList, makeSession, makeThreadList, wrapMethodResponse } from '../fixtures/jmap'
import { getJmapRequestBodies, jsonResponse, renderApp, respondWith, storeAuthenticatedSession } from './helpers'
import { fireEvent, waitFor, within } from '@testing-library/react'

function seedMailView(options: {
  emails?: ReturnType<typeof makeEmailList>
  detail?: ReturnType<typeof makeEmailDetail>
  searchResponse?: ReturnType<typeof makeEmailList>
  extraResponses?: any[]
} = {}) {
  const session = makeSession()
  const mailboxes = makeMailboxList()
  const identities = makeIdentityList()
  const inboxEmails = options.emails || makeEmailList('mailbox-inbox', 2, [
    {
      id: 'email-1',
      threadId: 'thread-1',
      from: [{ name: 'Alice Example', email: 'alice@example.com' }],
      subject: 'Quarterly update',
      preview: 'First preview',
      receivedAt: '2025-01-01T08:00:00.000Z',
      keywords: { '$seen': true },
    },
    {
      id: 'email-2',
      threadId: 'thread-2',
      from: [{ name: 'Bob Example', email: 'bob@example.com' }],
      subject: 'Team lunch',
      preview: 'Second preview',
      receivedAt: '2025-01-02T08:00:00.000Z',
      keywords: { '$seen': true },
    },
  ])
  const detail = options.detail || makeEmailDetail('email-1', {
    threadId: 'thread-1',
    from: [{ name: 'Alice Example', email: 'alice@example.com' }],
    subject: 'Quarterly update',
    receivedAt: '2025-01-01T08:00:00.000Z',
    bodyValues: {
      'body-1': {
        value: '<p>First message body</p>',
        isTruncated: false,
      },
    },
    htmlBody: [{ partId: 'body-1', type: 'text/html' }],
    textBody: [],
    keywords: { '$seen': true },
  })

  storeAuthenticatedSession(session)
  respondWith([
    jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-query-state' }, { methodCalls: ['Email/query'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', inboxEmails.get)], sessionState: 'threads-get-state' }, { methodCalls: ['Email/get'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(inboxEmails.emails))], sessionState: 'threads-state' }, { methodCalls: ['Thread/get'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList([detail.email]))], sessionState: 'detail-thread-state' }, { methodCalls: ['Thread/get'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', detail.result)], sessionState: 'detail-email-state' }, { methodCalls: ['Email/get'] }),
    ...(options.extraResponses || []),
  ])

  return { mailboxes, inboxEmails, detail }
}

describe('mail actions and shortcuts', () => {
  it('flags a message from the toolbar', async () => {
    seedMailView({
      extraResponses: [
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/set', { accountId: 'account-001', oldState: 'emails-old', newState: 'emails-new' })], sessionState: 'flag-save-state' }, { methodCalls: ['Email/set'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', makeEmailList('mailbox-inbox', 2, [{ id: 'email-1', threadId: 'thread-1', from: [{ name: 'Alice Example', email: 'alice@example.com' }], subject: 'Quarterly update', preview: 'First preview', receivedAt: '2025-01-01T08:00:00.000Z', keywords: { '$seen': true, '$flagged': true } }, { id: 'email-2', threadId: 'thread-2', from: [{ name: 'Bob Example', email: 'bob@example.com' }], subject: 'Team lunch', preview: 'Second preview', receivedAt: '2025-01-02T08:00:00.000Z', keywords: { '$seen': true } }]).query)], sessionState: 'flag-refetch-query' }, { methodCalls: ['Email/query'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', makeMailboxList())], sessionState: 'flag-refetch-mailboxes' }, { methodCalls: ['Mailbox/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', makeEmailList('mailbox-inbox', 2, [{ id: 'email-1', threadId: 'thread-1', from: [{ name: 'Alice Example', email: 'alice@example.com' }], subject: 'Quarterly update', preview: 'First preview', receivedAt: '2025-01-01T08:00:00.000Z', keywords: { '$seen': true, '$flagged': true } }, { id: 'email-2', threadId: 'thread-2', from: [{ name: 'Bob Example', email: 'bob@example.com' }], subject: 'Team lunch', preview: 'Second preview', receivedAt: '2025-01-02T08:00:00.000Z', keywords: { '$seen': true } }]).get)], sessionState: 'flag-refetch-emails' }, { methodCalls: ['Email/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(makeEmailList('mailbox-inbox', 2, [{ id: 'email-1', threadId: 'thread-1', from: [{ name: 'Alice Example', email: 'alice@example.com' }], subject: 'Quarterly update', preview: 'First preview', receivedAt: '2025-01-01T08:00:00.000Z', keywords: { '$seen': true, '$flagged': true } }, { id: 'email-2', threadId: 'thread-2', from: [{ name: 'Bob Example', email: 'bob@example.com' }], subject: 'Team lunch', preview: 'Second preview', receivedAt: '2025-01-02T08:00:00.000Z', keywords: { '$seen': true } }]).emails))], sessionState: 'flag-refetch-threads' }, { methodCalls: ['Thread/get'] }),
      ],
    })

    const { user, screen } = renderApp()

    const message = await screen.findByRole('option', { name: /Quarterly update/ })
    await user.click(within(message).getByText('Quarterly update'))
    await screen.findByText('First message body')
    await user.click(screen.getByRole('button', { name: 'Flag' }))

    await waitFor(() => {
      const bodies = getJmapRequestBodies(['Email/set'])
      expect(bodies[bodies.length - 1].methodCalls[0][1].update['email-1']).toEqual({ 'keywords/$flagged': true })
    })
  })

  it('moves a message to Trash from the toolbar', async () => {
    seedMailView({
      extraResponses: [
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/set', { accountId: 'account-001', oldState: 'emails-old', newState: 'emails-new' })], sessionState: 'trash-save-state' }, { methodCalls: ['Email/set'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', makeEmailList('mailbox-inbox', 2).query)], sessionState: 'trash-refetch-query' }, { methodCalls: ['Email/query'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', makeMailboxList())], sessionState: 'trash-refetch-mailboxes' }, { methodCalls: ['Mailbox/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', makeEmailList('mailbox-inbox', 2).get)], sessionState: 'trash-refetch-emails' }, { methodCalls: ['Email/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(makeEmailList('mailbox-inbox', 2).emails))], sessionState: 'trash-refetch-threads' }, { methodCalls: ['Thread/get'] }),
      ],
    })

    const { user, screen } = renderApp()

    const message = await screen.findByRole('option', { name: /Quarterly update/ })
    await user.click(within(message).getByText('Quarterly update'))
    await screen.findByText('First message body')
    await user.click(screen.getByRole('button', { name: 'Trash' }))

    await waitFor(() => {
      const bodies = getJmapRequestBodies(['Email/set'])
      expect(bodies[bodies.length - 1].methodCalls[0][1].update['email-1']).toEqual({ mailboxIds: { 'mailbox-trash': true } })
    })
  })

  it('removes the trashed message from the list after refetch', async () => {
    // After trash, the server returns only the remaining email
    const remainingEmails = makeEmailList('mailbox-inbox', 1, [
      {
        id: 'email-2',
        threadId: 'thread-2',
        from: [{ name: 'Bob Example', email: 'bob@example.com' }],
        subject: 'Team lunch',
        preview: 'Second preview',
        receivedAt: '2025-01-02T08:00:00.000Z',
        keywords: { '$seen': true },
      },
    ])

    seedMailView({
      extraResponses: [
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/set', { accountId: 'account-001', oldState: 'emails-old', newState: 'emails-new' })], sessionState: 'trash-save-state' }, { methodCalls: ['Email/set'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', remainingEmails.query)], sessionState: 'trash-refetch-query' }, { methodCalls: ['Email/query'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', makeMailboxList())], sessionState: 'trash-refetch-mailboxes' }, { methodCalls: ['Mailbox/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', remainingEmails.get)], sessionState: 'trash-refetch-emails' }, { methodCalls: ['Email/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(remainingEmails.emails))], sessionState: 'trash-refetch-threads' }, { methodCalls: ['Thread/get'] }),
      ],
    })

    const { user, screen } = renderApp()

    const message = await screen.findByRole('option', { name: /Quarterly update/ })
    await user.click(within(message).getByText('Quarterly update'))
    await screen.findByText('First message body')
    await user.click(screen.getByRole('button', { name: 'Trash' }))

    // After the refetch, the trashed email should no longer be in the list
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Quarterly update/ })).not.toBeInTheDocument()
    })

    // The remaining email should still be visible
    expect(screen.getByRole('option', { name: /Team lunch/ })).toBeInTheDocument()
  })

  it('filters the message list with search and fetches snippets', async () => {
    seedMailView({
      searchResponse: makeEmailList('mailbox-inbox', 1, [{
        id: 'email-2',
        threadId: 'thread-2',
        from: [{ name: 'Bob Example', email: 'bob@example.com' }],
        subject: 'Quarterly update follow-up',
        preview: 'Matched preview',
        receivedAt: '2025-01-02T08:00:00.000Z',
        keywords: { '$seen': true },
      }]),
      extraResponses: [
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', makeEmailList('mailbox-inbox', 1, [{
          id: 'email-2',
          threadId: 'thread-2',
          from: [{ name: 'Bob Example', email: 'bob@example.com' }],
          subject: 'Quarterly update follow-up',
          preview: 'Matched preview',
          receivedAt: '2025-01-02T08:00:00.000Z',
          keywords: { '$seen': true },
        }]).query)], sessionState: 'search-query-state' }, { methodCalls: ['Email/query'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', makeEmailList('mailbox-inbox', 1, [{
          id: 'email-2',
          threadId: 'thread-2',
          from: [{ name: 'Bob Example', email: 'bob@example.com' }],
          subject: 'Quarterly update follow-up',
          preview: 'Matched preview',
          receivedAt: '2025-01-02T08:00:00.000Z',
          keywords: { '$seen': true },
        }]).get)], sessionState: 'search-get-state' }, { methodCalls: ['Email/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(makeEmailList('mailbox-inbox', 1, [{
          id: 'email-2',
          threadId: 'thread-2',
          from: [{ name: 'Bob Example', email: 'bob@example.com' }],
          subject: 'Quarterly update follow-up',
          preview: 'Matched preview',
          receivedAt: '2025-01-02T08:00:00.000Z',
          keywords: { '$seen': true },
        }]).emails))], sessionState: 'search-thread-state' }, { methodCalls: ['Thread/get'] }),
        jsonResponse({ methodResponses: [wrapMethodResponse('SearchSnippet/get', { accountId: 'account-001', state: 'snippet-state', list: [{ emailId: 'email-2', preview: 'Matched preview' }], notFound: [] })], sessionState: 'snippet-state' }, { methodCalls: ['SearchSnippet/get'] }),
      ],
    })

    const { user, screen } = renderApp()

    await screen.findByRole('option', { name: /Quarterly update/ })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search emails' }), { target: { value: 'Quarterly' } })

    await waitFor(() => {
      const queryBodies = getJmapRequestBodies(['Email/query'])
      const searchQuery = queryBodies[queryBodies.length - 1]
      expect(searchQuery.methodCalls[0][1].filter.conditions[1].text).toBe('Quarterly')
    })
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1)
    })
  })

  it('navigates messages and opens keyboard shortcuts help', async () => {
    seedMailView()
    const { user, screen } = renderApp()

    const first = await screen.findByRole('option', { name: /Quarterly update/ })
    const second = screen.getByRole('option', { name: /Team lunch/ })

    await user.click(within(first).getByText('Quarterly update'))
    await user.keyboard('j')
    expect(second).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('k')
    expect(first).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('?')
    expect(await screen.findByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument()
  })
})
