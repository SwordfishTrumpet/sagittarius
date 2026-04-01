import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeEmailList, makeIdentityList, makeMailboxList, makeSession, wrapMethodResponse } from '../fixtures/jmap'
import { jsonResponse, renderApp, respondWith } from './helpers'

describe('login flow', () => {
  it('logs in, stores the session, and renders mailboxes', async () => {
    const session = makeSession()
    const mailboxes = makeMailboxList()
    const identities = makeIdentityList()
    const inboxEmails = makeEmailList('mailbox-inbox', 0)

    respondWith([
      jsonResponse(session, { url: '/jmap/session' }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-state' }, { methodCalls: ['Email/query'] }),
    ])

    const { user, screen } = renderApp()

    await user.type(screen.getByLabelText('Email or username'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect((await screen.findAllByText('Inbox')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sent').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Drafts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Trash').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(sessionStorage.getItem('jmap_session')).toContain('user@example.com')
      expect(sessionStorage.getItem('jmap_auth')).toMatch(/^Basic /)
    })
  })

  it('shows an authentication error when both auth attempts fail', async () => {
    respondWith([
      jsonResponse(null, { url: '/jmap/session', status: 401, text: 'Unauthorized' }),
      jsonResponse(null, { url: '/jmap/session', status: 401, text: 'Unauthorized' }),
    ])

    const { user, screen } = renderApp()

    await user.type(screen.getByLabelText('Email or username'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'bad-password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Failed to authenticate. Please check your credentials.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })
})
