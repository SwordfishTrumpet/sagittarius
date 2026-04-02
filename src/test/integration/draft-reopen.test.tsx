import { within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeEmailDetail, makeEmailList, makeIdentityList, makeMailboxList, makeSession, makeThreadList, wrapMethodResponse } from '../fixtures/jmap'
import { jsonResponse, renderApp, respondWith, storeAuthenticatedSession } from './helpers'

describe('draft reopen flow', () => {
  it('opens a draft from the Drafts mailbox in the composer', async () => {
    const session = makeSession()
    const mailboxes = makeMailboxList()
    const identities = makeIdentityList()
    const inboxEmails = makeEmailList('mailbox-inbox', 0)
    const draftEmails = makeEmailList('mailbox-drafts', 1, [
      {
        id: 'draft-1',
        threadId: 'thread-draft-1',
        from: [{ name: 'User Example', email: 'user@example.com' }],
        subject: 'Saved draft',
        preview: 'Draft preview',
        keywords: { '$draft': true, '$seen': true },
      },
    ])

    const draftDetail = makeEmailDetail('draft-1', {
      threadId: 'thread-draft-1',
      mailboxIds: { 'mailbox-drafts': true },
      from: [{ name: 'User Example', email: 'user@example.com' }],
      to: [{ name: 'Friend Example', email: 'friend@example.com' }],
      subject: 'Saved draft',
      keywords: { '$draft': true, '$seen': true },
      bodyValues: {
        'body-1': {
          value: '<p>Draft body from server</p>',
          isTruncated: false,
        },
      },
      htmlBody: [{ partId: 'body-1', type: 'text/html' }],
      textBody: [],
    }).email

    storeAuthenticatedSession(session)
    respondWith([
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'inbox-query-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', draftEmails.query)], sessionState: 'drafts-query-state' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', draftEmails.get)], sessionState: 'drafts-get-state' }, { methodCalls: ['Email/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList(draftEmails.emails))], sessionState: 'drafts-thread-state' }, { methodCalls: ['Thread/get'] }),
      // Email/get for reader pane when draft is selected
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', { accountId: 'account-001', state: 'draft-open-state', list: [draftDetail], notFound: [] })], sessionState: 'draft-open-state' }, { methodCalls: ['Email/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Thread/get', makeThreadList([draftDetail]))], sessionState: 'draft-detail-thread-state' }, { methodCalls: ['Thread/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', { accountId: 'account-001', state: 'draft-detail-state', list: [draftDetail], notFound: [] })], sessionState: 'draft-detail-state' }, { methodCalls: ['Email/get'] }),
      // Extra Email/get for fetchEmailWithBody when double-clicking to reopen draft
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/get', { accountId: 'account-001', state: 'draft-reopen-state', list: [draftDetail], notFound: [] })], sessionState: 'draft-reopen-state' }),
    ])

    const { user, screen } = renderApp()

    await screen.findByRole('treeitem', { name: 'Drafts' })
    await user.click(screen.getByRole('treeitem', { name: 'Drafts' }))

    const draftOption = await screen.findByLabelText(/Saved draft/)
    // Double-click on the option itself (not the text inside) to trigger draft open
    await user.dblClick(draftOption)
    // Wait for the async operation and React re-render
    await new Promise(resolve => setTimeout(resolve, 500))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue('friend@example.com')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Saved draft')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Message body' })).toHaveValue('<p>Draft body from server</p>')
  })
})
