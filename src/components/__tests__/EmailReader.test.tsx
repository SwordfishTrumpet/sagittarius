import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EmailReader, type EmailReaderProps } from '../EmailReader'
import { JMAPProtocolError, ServerUnreachableError } from '../../utils/jmapErrors'

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

/** Helper to create test emails with minimal required fields */
function createTestEmail(overrides: Record<string, unknown>): NonNullable<EmailReaderProps['threadEmails']>[0] {
  return {
    id: 'email-1',
    blobId: 'blob-1',
    threadId: 'thread-1',
    mailboxIds: { 'inbox-1': true },
    keywords: {},
    size: 1000,
    receivedAt: '2025-01-01T12:00:00Z',
    hasAttachment: false,
    preview: 'Test preview',
    subject: 'Test Subject',
    from: [{ name: 'Alice', email: 'alice@example.com' }],
    to: [{ name: 'Bob', email: 'bob@example.com' }],
    cc: null,
    bcc: null,
    replyTo: null,
    ...overrides,
  } as NonNullable<EmailReaderProps['threadEmails']>[0];
}

const baseProps: EmailReaderProps = {
  emailLoading: false,
  isEmailDetailError: false,
  emailDetailError: null,
  selectedEmailId: 'email-1',
  mailboxes: [],
  primaryIdentity: undefined,
  threadEmails: undefined,
  sendMDN: { mutate: vi.fn() },
  updateKeywords: { mutate: vi.fn() },
}

/** Wrap every render in a QueryClientProvider (EmailReader calls useQueryClient). */
function renderReader(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('EmailReader', () => {
  beforeEach(() => {
    getBlobUrl.mockClear()
  })

  it('blocks remote images until approved', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        threadEmails={[
          createTestEmail({
            subject: 'Remote images',
            htmlBody: [{ partId: '1', type: 'text/html' }],
            bodyValues: {
              '1': { value: '<p>Hello</p><img src="https://example.com/track.png" alt="t">' },
            },
          }),
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
    renderReader(
      <EmailReader
        {...baseProps}
        threadEmails={[
          createTestEmail({
            subject: 'Plain text',
            textBody: [{ partId: '1', type: 'text/plain' }],
            bodyValues: {
              '1': { value: '<script>alert(1)</script>\nhello' },
            },
          }),
        ]}
      />,
    )

    const html = screen.getByTestId('email-frame').getAttribute('data-html') || ''
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('resolves CID images before rendering', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        threadEmails={[
          createTestEmail({
            subject: 'Inline image',
            htmlBody: [{ partId: '1', type: 'text/html' }],
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
          }),
        ]}
      />,
    )

    expect(getBlobUrl).toHaveBeenCalledWith('blob-1', 'image/png', 'image.png')
    const html = screen.getByTestId('email-frame').getAttribute('data-html') || ''
    expect(html).toContain('https://mail.test/download/blob-1/image.png')
    expect(html).toContain('data-cid-src="https://mail.test/download/blob-1/image.png"')
  })

  it('shows a safe fallback for invalid dates', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        threadEmails={[
          createTestEmail({
            subject: 'Bad date',
            receivedAt: 'not-a-date',
            htmlBody: [{ partId: '1', type: 'text/html' }],
            bodyValues: {
              '1': { value: '<p>Hello</p>' },
            },
          }),
        ]}
      />,
    )

    expect(screen.getByText('Unknown date')).toBeInTheDocument()
  })

  it('picks the richest non-empty HTML body part in multipart emails (BUG-2026-036)', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        threadEmails={[
          createTestEmail({
            subject: 'Multipart',
            htmlBody: [
              { partId: 'empty', type: 'text/html' },
              { partId: 'rich', type: 'text/html' },
            ],
            bodyValues: {
              'empty': { value: '' },
              'rich': { value: '<p>Real content</p>' },
            },
          }),
        ]}
      />,
    )

    const html = screen.getByTestId('email-frame').getAttribute('data-html') || ''
    expect(html).toContain('Real content')
  })

  it('falls back to the first non-empty text body when no HTML has content (BUG-2026-036)', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        threadEmails={[
          createTestEmail({
            subject: 'Multi text',
            htmlBody: [{ partId: 'h1', type: 'text/html' }],
            textBody: [
              { partId: 't1', type: 'text/plain' },
              { partId: 't2', type: 'text/plain' },
            ],
            bodyValues: {
              'h1': { value: '   ' },
              't1': { value: '' },
              't2': { value: 'plain fallback' },
            },
          }),
        ]}
      />,
    )

    const html = screen.getByTestId('email-frame').getAttribute('data-html') || ''
    expect(html).toContain('plain fallback')
  })

  it('retry button refetches the detail query instead of reloading the page (BUG-2026-037)', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        isEmailDetailError={true}
        emailDetailError={new Error('network down')}
        threadEmails={undefined}
      />,
    )

    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry).toBeInTheDocument()

    // Clicking Retry must not navigate/reload (window.location.reload spy)
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })

    fireEvent.click(retry)

    expect(reloadSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Failed to load message')).toBeInTheDocument()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: window.location,
    })
  })

  it('renders the classified message, not the raw status string (issue #8)', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        isEmailDetailError={true}
        emailDetailError={new JMAPProtocolError('JMAP request failed: 500', 500)}
        threadEmails={undefined}
      />,
    )

    expect(screen.getByText('The mail server returned an error (HTTP 500). Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/JMAP request failed/)).not.toBeInTheDocument()
  })

  it('renders the server-unreachable message for dead-backend errors (issue #8)', () => {
    renderReader(
      <EmailReader
        {...baseProps}
        isEmailDetailError={true}
        emailDetailError={new ServerUnreachableError('JMAP request failed: 502')}
        threadEmails={undefined}
      />,
    )

    expect(screen.getByText('Mail server unreachable. Please check that the mail server is running and try again.')).toBeInTheDocument()
    expect(screen.queryByText(/JMAP request failed/)).not.toBeInTheDocument()
  })
})
