import { describe, expect, it } from 'vitest'
import { makeEmailDetail, makeEmailList, makeIdentityList, makeMailboxList, makeSession, makeThreadList, wrapMethodResponse } from '../fixtures/jmap'
import { jsonResponse, renderApp, respondWith, storeAuthenticatedSession } from './helpers'
import { within } from '@testing-library/react'

function seedReplyThread() {
  const session = makeSession()
  const mailboxes = makeMailboxList()
  const identities = makeIdentityList()
  const inboxEmails = makeEmailList('mailbox-inbox', 1, [{
    id: 'email-1',
    threadId: 'thread-1',
    from: [{ name: 'Alice Example', email: 'alice@example.com' }],
    to: [{ name: 'User Example', email: 'user@example.com' }],
    cc: [{ name: 'Copy Example', email: 'copy@example.com' }],
    subject: 'Project update',
    preview: 'See attached.',
    receivedAt: '2025-01-01T09:00:00.000Z',
    keywords: { '$seen': true },
  }])
  const detail = makeEmailDetail('email-1', {
    threadId: 'thread-1',
    from: [{ name: 'Alice Example', email: 'alice@example.com' }],
    to: [{ name: 'User Example', email: 'user@example.com' }],
    cc: [{ name: 'Copy Example', email: 'copy@example.com' }],
    subject: 'Project update',
    receivedAt: '2025-01-01T09:00:00.000Z',
    bodyValues: {
      'body-1': {
        value: '<p>See attached.</p>',
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
  ])

  return { detail }
}

describe('reply and forward workflows', () => {
  it('prefills a reply with the sender as the recipient', async () => {
    const { detail } = seedReplyThread()
    const { user, screen } = renderApp()

    const message = await screen.findByRole('option', { name: /Project update/ })
    await user.click(within(message).getByText('Project update'))
    const frame = await screen.findByTestId('email-frame')
    expect(within(frame).getByText('See attached.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reply' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Recipients/ })).toHaveValue('alice@example.com')
    expect(screen.getByRole('textbox', { name: 'Subject:' })).toHaveValue('Re: Project update')
    expect((screen.getByLabelText('Message body') as HTMLTextAreaElement).value).toContain('wrote:')
    expect((screen.getByLabelText('Message body') as HTMLTextAreaElement).value).toContain('See attached.')
    expect(detail.email.subject).toBe('Project update')
  })

  it('prefills reply-all recipients from the full thread header', async () => {
    seedReplyThread()
    const { user, screen } = renderApp()

    const message = await screen.findByRole('option', { name: /Project update/ })
    await user.click(within(message).getByText('Project update'))

    await user.click(screen.getByRole('button', { name: 'Reply All' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Recipients/ })).toHaveValue('alice@example.com, user@example.com, copy@example.com')
    expect(screen.getByRole('textbox', { name: 'Subject:' })).toHaveValue('Re: Project update')
    expect((screen.getByLabelText('Message body') as HTMLTextAreaElement).value).toContain('See attached.')
  })

  it('prefills a forward with an empty recipient list and forwarded quote', async () => {
    seedReplyThread()
    const { user, screen } = renderApp()

    const message = await screen.findByRole('option', { name: /Project update/ })
    await user.click(within(message).getByText('Project update'))

    await user.click(screen.getByRole('button', { name: 'Forward' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Recipients/ })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Subject:' })).toHaveValue('Fwd: Project update')
    expect((screen.getByLabelText('Message body') as HTMLTextAreaElement).value).toContain('Begin forwarded message')
    expect((screen.getByLabelText('Message body') as HTMLTextAreaElement).value).toContain('Alice Example &lt;alice@example.com&gt;')
  })
})
