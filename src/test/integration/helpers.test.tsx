import { describe, expect, it } from 'vitest'
import { jsonResponse, respondWith } from './helpers'

/**
 * Fetch-queue robustness (issue #10).
 *
 * The whole-App integration helper (helpers.tsx) must tolerate reordered and
 * duplicate JMAP requests: under full-suite parallel load, query hooks can
 * fire in an order that differs from the seeded respondWith queue, and
 * mutations invalidate queries that then refetch. The old FIFO-spliced queue
 * threw on any request that did not line up, which intermittently starved
 * later assertions of data.
 *
 * These tests exercise the queue contract directly through the stubbed
 * `fetch` (installed by the helper's beforeEach).
 */
describe('integration fetch queue', () => {
  it('serves two identical Email/get requests the same seeded response', async () => {
    respondWith([
      jsonResponse(
        { methodResponses: [['Email/get', { accountId: 'account-001', list: [{ id: 'email-1' }], notFound: [] }, '0']], sessionState: 's' },
        { methodCalls: ['Email/get'] },
      ),
    ])

    const body = {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [['Email/get', { accountId: 'account-001', ids: ['email-1'] }, '0']],
    }

    const first = await fetch('/jmap/', { method: 'POST', body: JSON.stringify(body) })
    const second = await fetch('/jmap/', { method: 'POST', body: JSON.stringify(body) })

    const firstJson = await first.json()
    const secondJson = await second.json()
    expect(firstJson).toEqual(secondJson)
    expect(firstJson.methodResponses[0][1].list).toEqual([{ id: 'email-1' }])
  })

  it('matches reordered requests regardless of the seeded order', async () => {
    respondWith([
      jsonResponse({ methodResponses: [['Mailbox/get', { list: [{ id: 'inbox' }] }, '0']], sessionState: 'm' }, { methodCalls: ['Mailbox/get'] }),
      jsonResponse({ methodResponses: [['Email/query', { ids: ['email-1'] }, '0']], sessionState: 'q' }, { methodCalls: ['Email/query'] }),
    ])

    const query = { using: ['urn:ietf:params:jmap:core'], methodCalls: [['Email/query', { accountId: 'account-001' }, '0']] }
    const mailboxes = { using: ['urn:ietf:params:jmap:core'], methodCalls: [['Mailbox/get', { accountId: 'account-001' }, '0']] }

    const queryResponse = await (await fetch('/jmap/', { method: 'POST', body: JSON.stringify(query) })).json()
    const mailboxesResponse = await (await fetch('/jmap/', { method: 'POST', body: JSON.stringify(mailboxes) })).json()

    expect(queryResponse.methodResponses[0][0]).toBe('Email/query')
    expect(mailboxesResponse.methodResponses[0][0]).toBe('Mailbox/get')
  })

  it('consumes seeded responses in order when requests arrive in the seeded sequence', async () => {
    respondWith([
      jsonResponse({ methodResponses: [['Email/query', { ids: ['email-1'] }, '0']], sessionState: 'first' }, { methodCalls: ['Email/query'] }),
      jsonResponse({ methodResponses: [['Email/query', { ids: ['email-2'] }, '0']], sessionState: 'second' }, { methodCalls: ['Email/query'] }),
    ])

    const body = { using: ['urn:ietf:params:jmap:core'], methodCalls: [['Email/query', { accountId: 'account-001' }, '0']] }

    const first = await (await fetch('/jmap/', { method: 'POST', body: JSON.stringify(body) })).json()
    const second = await (await fetch('/jmap/', { method: 'POST', body: JSON.stringify(body) })).json()

    expect(first.sessionState).toBe('first')
    expect(second.sessionState).toBe('second')
  })

  it('repeatable responses serve every matching request without being consumed', async () => {
    respondWith([
      jsonResponse(
        { methodResponses: [['Identity/get', { list: [{ id: 'identity-001' }], notFound: [] }, '0']], sessionState: 'i' },
        { methodCalls: ['Identity/get'], repeatable: true },
      ),
    ])

    const body = { using: ['urn:ietf:params:jmap:core'], methodCalls: [['Identity/get', { accountId: 'account-001', ids: null }, '0']] }

    const first = await (await fetch('/jmap/', { method: 'POST', body: JSON.stringify(body) })).json()
    const second = await (await fetch('/jmap/', { method: 'POST', body: JSON.stringify(body) })).json()
    const third = await (await fetch('/jmap/', { method: 'POST', body: JSON.stringify(body) })).json()

    expect(first).toEqual(second)
    expect(second).toEqual(third)
    expect(third.methodResponses[0][1].list).toEqual([{ id: 'identity-001' }])
  })

  it('answers genuinely unknown requests with a graceful 404 instead of throwing', async () => {
    const response = await fetch('/api/server-fingerprint')
    expect(response.status).toBe(404)
    expect(response.ok).toBe(false)
    expect(await response.text()).toBe('Not Found')
  })
})
