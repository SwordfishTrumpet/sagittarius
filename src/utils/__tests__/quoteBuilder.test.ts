import { describe, expect, it } from 'vitest'
import { buildForwardQuote, buildReplyQuote } from '../quoteBuilder'

const email = {
  from: [{ name: 'Alice', email: 'alice@example.com' }],
  to: [{ name: 'Bob', email: 'bob@example.com' }],
  subject: 'Hello',
  receivedAt: '2025-01-01T12:00:00Z',
  htmlBody: [{ partId: '1' }],
  bodyValues: {
    '1': { value: '<p>Body</p>' },
  },
}

describe('quoteBuilder', () => {
  it('builds reply quotes without leading double breaks', () => {
    const html = buildReplyQuote(email)

    expect(html).not.toContain('<br/><br/>')
    expect(html).toContain('id="quoted-content" data-sagittarius-quote="1" style="margin-top: 16px;"')
  })

  it('builds forward quotes without stacked forwarded-message breaks', () => {
    const html = buildForwardQuote(email)

    expect(html).not.toContain('<br/><br/>')
    expect(html).toContain('id="quoted-content" data-sagittarius-quote="1" style="margin-top: 16px;"')
    expect(html).toContain('<b>Begin forwarded message:</b><br/>')
  })

  it('renders plain text quote bodies with zero pre margin', () => {
    const plainTextHtml = buildReplyQuote({
      ...email,
      htmlBody: undefined,
      textBody: [{ partId: '1' }],
      bodyValues: {
        '1': { value: 'line 1\n\nline 2' },
      },
    })

    expect(plainTextHtml).toContain('white-space: pre-wrap; margin: 0;')
  })
})
