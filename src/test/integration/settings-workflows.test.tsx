import { describe, expect, it } from 'vitest'
import { makeEmailList, makeIdentityList, makeMailboxList, makeSession, wrapMethodResponse } from '../fixtures/jmap'
import { getJmapRequestBodies, jsonResponse, renderApp, respondWith, storeAuthenticatedSession } from './helpers'
import { waitFor } from '@testing-library/react'

function seedSettingsApp(extraResponses: any[] = []) {
  const session = makeSession()
  const mailboxes = makeMailboxList()
  const identities = makeIdentityList()
  const inboxEmails = makeEmailList('mailbox-inbox', 0)

  storeAuthenticatedSession(session)
  respondWith([
    jsonResponse({ methodResponses: [wrapMethodResponse('Mailbox/get', mailboxes)], sessionState: 'mailboxes-state' }, { methodCalls: ['Mailbox/get'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Identity/get', identities)], sessionState: 'identities-state' }, { methodCalls: ['Identity/get'] }),
    jsonResponse({ methodResponses: [wrapMethodResponse('Email/query', inboxEmails.query)], sessionState: 'threads-state' }, { methodCalls: ['Email/query'] }),
    ...extraResponses,
  ])
}

describe('settings workflows', () => {
  it('saves vacation response changes', async () => {
    seedSettingsApp([
      jsonResponse({ methodResponses: [wrapMethodResponse('VacationResponse/get', { accountId: 'account-001', state: 'vacation-state-001', list: [{ id: 'singleton', isEnabled: false, subject: null, textBody: null, fromDate: null, toDate: null }], notFound: [] })], sessionState: 'vacation-load-state' }, { methodCalls: ['VacationResponse/get'] }),
      jsonResponse({ methodResponses: [wrapMethodResponse('VacationResponse/set', { accountId: 'account-001', oldState: 'vacation-old-state', newState: 'vacation-new-state' })], sessionState: 'vacation-save-state' }, { methodCalls: ['VacationResponse/set'] }),
    ])

    const { user, screen } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('tab', { name: 'Vacation' }))

    expect(await screen.findByText('Vacation Response')).toBeInTheDocument()
    await user.click(screen.getByRole('switch'))
    await user.type(screen.getByPlaceholderText('Out of Office'), 'OOO')
    await user.type(screen.getByPlaceholderText("I'm currently out of office and will reply when I return."), 'Back next week')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const vacationBodies = getJmapRequestBodies(['VacationResponse/set'])
      const vacationSet = vacationBodies[vacationBodies.length - 1]
      expect(vacationSet.methodCalls[0][0]).toBe('VacationResponse/set')
      expect(vacationSet.methodCalls[0][1]).toMatchObject({
        accountId: 'account-001',
        update: {
          singleton: {
            isEnabled: true,
            subject: 'OOO',
            textBody: 'Back next week',
            fromDate: null,
            toDate: null,
          },
        },
      })
    })
  })

  it('creates a new identity from the settings pane', async () => {
    seedSettingsApp([
      jsonResponse({ methodResponses: [wrapMethodResponse('Identity/set', { accountId: 'account-001', oldState: 'identities-old', newState: 'identities-new', created: { 'new-1': { id: 'identity-002' } } })], sessionState: 'identity-create-state' }, { methodCalls: ['Identity/set'] }),
    ])

    const { user, screen } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('tab', { name: 'Identities' }))
    await screen.findByText('user@example.com')
    await user.click(screen.getByRole('button', { name: 'Add Identity' }))

    await user.type(screen.getByPlaceholderText('Your Name'), 'New Alias')
    await user.type(screen.getByPlaceholderText('you@example.com'), 'alias@example.com')
    await user.type(screen.getByPlaceholderText('replies@example.com'), 'reply@example.com')
    await user.type(screen.getByPlaceholderText(/Your signature/), '—\nNew Alias')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const identityBodies = getJmapRequestBodies(['Identity/set'])
      const identitySet = identityBodies[identityBodies.length - 1]
      expect(identitySet.methodCalls[0][0]).toBe('Identity/set')
      const createdKey = Object.keys(identitySet.methodCalls[0][1].create)[0]
      expect(identitySet.methodCalls[0][1].create[createdKey]).toMatchObject({
        name: 'New Alias',
        email: 'alias@example.com',
        replyTo: [{ email: 'reply@example.com' }],
        textSignature: '—\nNew Alias',
      })
    })
  })

  it('shows the sieve filters tab when supported', async () => {
    seedSettingsApp([
      jsonResponse({ methodResponses: [wrapMethodResponse('SieveScript/get', { accountId: 'account-001', state: 'sieve-state-001', list: [], notFound: [] })], sessionState: 'sieve-load-state' }, { methodCalls: ['SieveScript/get'] }),
    ])

    const { user, screen } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('tab', { name: 'Filters' }))

    expect(await screen.findByText('No filter rules yet')).toBeInTheDocument()
    expect(screen.queryByText('Sieve filters are not supported')).not.toBeInTheDocument()
  })
})
