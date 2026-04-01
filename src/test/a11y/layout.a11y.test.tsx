import { describe, expect, it } from 'vitest'
import { makeEmailList, makeIdentityList, makeMailboxList, makeSession, wrapMethodResponse } from '../fixtures/jmap'
import { checkA11y } from './helpers'
import { jsonResponse, renderApp, respondWith, storeAuthenticatedSession } from '../integration/helpers'

describe('App layout accessibility', () => {
  it('renders the authenticated three-pane layout without axe violations', async () => {
    const session = makeSession()
    const mailboxes = makeMailboxList()
    const identities = makeIdentityList()
    const inboxEmails = makeEmailList('mailbox-inbox', 2)

    storeAuthenticatedSession(session)
    respondWith([
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', inboxEmails.get)], sessionState: 'emails-state' }, { methodCalls: ['Email/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', { list: inboxEmails.emails.map((email) => ({ id: email.threadId, emailIds: [email.id] })), state: 'threads', notFound: [] })], sessionState: 'threads-state' }, { methodCalls: ['Thread/get'] }),
    ])

    const { container, screen } = renderApp()
    await screen.findAllByText('Inbox')

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Message list' })).toBeInTheDocument()
    expect(screen.getByLabelText('Mailbox navigation')).toBeInTheDocument()
    expect(screen.getByLabelText('Email reading pane')).toBeInTheDocument()
    expect((await checkA11y(container)).violations).toHaveLength(0)
  })
})
