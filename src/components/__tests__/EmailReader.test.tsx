import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EmailReader } from '../EmailReader'

const { getBlobUrl, getAuthHeader, getSession } = vi.hoisted(() => ({
  getBlobUrl: vi.fn(() => 'https://mail.test/download/blob-1/image.png'),
  getAuthHeader: vi.fn(() => 'Basic test'),
  getSession: vi.fn(() => ({
    downloadUrl: 'https://mail.test/download/{accountId}/{blobId}/{name}?type={type}',
  })),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getBlobUrl,
    getAuthHeader,
    getSession,
  },
}))

vi.mock('../EmailBodyFrame', () => ({
  EmailBodyFrame: ({ html }: { html: string }) => <div data-testid="email-frame" data-html={html} />,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const baseProps = {
  emailLoading: false,
  isEmailDetailError: false,
  emailDetailError: null,
  selectedEmailId: 'email-1',
  mailboxes: [],
  primaryIdentity: null,
  sendMDN: { mutate: vi.fn() },
  updateKeywords: { mutate: vi.fn() },
}

describe('EmailReader', () => {
  beforeEach(() => {
    getBlobUrl.mockClear()
  })

  it('blocks remote images until approved', () => {
    render(
      <EmailReader
        {...baseProps}
        threadEmails={[
          {
            id: 'email-1',
            subject: 'Remote images',
            receivedAt: '2025-01-01T12:00:00Z',
            from: [{ name: 'Alice', email: 'alice@example.com' }],
            to: [{ name: 'Bob', email: 'bob@example.com' }],
            htmlBody: [{ partId: '1' }],
            bodyValues: {
              '1': { value: '<p>Hello</p><img src="https://example.com/track.png" alt="t">' },
            },
          },
        ]}
      />,
    )

    expect(screen.getByText('This message contains 1 remote image')).toBeInTheDocument()

    const frame = screen.getByTestId('email-frame')
    expect(frame.getAttribute('data-html')).toContain('data:image/svg+xml')
    expect(frame.getAttribute('data-html')).toContain('data-blocked-src="https://example.com/track.png"')

    fireEvent.click(screen.getByRole('button', { name: 'Load Images' }))

    expect(screen.queryByText('This message contains 1 remote image')).not.toBeInTheDocument()
    expect(frame.getAttribute('data-html')).toContain('https://example.com/track.png')
    expect(frame.getAttribute('data-html')).not.toContain('data:image/svg+xml')
  })

  it('escapes plain text email bodies', () => {
    render(
      <EmailReader
        {...baseProps}
        threadEmails={[
          {
            id: 'email-1',
            subject: 'Plain text',
            receivedAt: '2025-01-01T12:00:00Z',
            from: [{ name: 'Alice', email: 'alice@example.com' }],
            to: [{ name: 'Bob', email: 'bob@example.com' }],
            textBody: [{ partId: '1' }],
            bodyValues: {
              '1': { value: '<script>alert(1)</script>\nhello' },
            },
          },
        ]}
      />,
    )

    const html = screen.getByTestId('email-frame').getAttribute('data-html') || ''
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('resolves CID images before rendering', () => {
    render(
      <EmailReader
        {...baseProps}
        threadEmails={[
          {
            id: 'email-1',
            subject: 'Inline image',
            receivedAt: '2025-01-01T12:00:00Z',
            from: [{ name: 'Alice', email: 'alice@example.com' }],
            to: [{ name: 'Bob', email: 'bob@example.com' }],
            htmlBody: [{ partId: '1' }],
            bodyValues: {
              '1': { value: '<p>Hi</p><img src="cid:inline-1">' },
            },
            attachments: [
              {
                cid: 'inline-1',
                blobId: 'blob-1',
                type: 'image/png',
                name: 'image.png',
              },
            ],
          },
        ]}
      />,
    )

    expect(getBlobUrl).toHaveBeenCalledWith('blob-1', 'image/png', 'image.png')
    const html = screen.getByTestId('email-frame').getAttribute('data-html') || ''
    expect(html).toContain('https://mail.test/download/blob-1/image.png')
    expect(html).toContain('data-cid-src="inline-1"')
  })

  it('shows a safe fallback for invalid dates', () => {
    render(
      <EmailReader
        {...baseProps}
        threadEmails={[
          {
            id: 'email-1',
            subject: 'Bad date',
            receivedAt: 'not-a-date',
            from: [{ name: 'Alice', email: 'alice@example.com' }],
            to: [{ name: 'Bob', email: 'bob@example.com' }],
            htmlBody: [{ partId: '1' }],
            bodyValues: {
              '1': { value: '<p>Hello</p>' },
            },
          },
        ]}
      />,
    )

    expect(screen.getByText('Unknown date')).toBeInTheDocument()
  })
})
