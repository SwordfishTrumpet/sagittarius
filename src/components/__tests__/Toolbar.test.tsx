import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from '../Toolbar'
import type { Email } from '../../types/jmap'

function createTestEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: 'email-1',
    blobId: 'blob-1',
    threadId: 'thread-1',
    mailboxIds: { 'mbox-1': true },
    keywords: { $seen: true },
    size: 1024,
    receivedAt: '2025-01-01T12:00:00Z',
    hasAttachment: false,
    preview: 'Preview text',
    subject: 'Test Subject',
    from: [{ name: 'Sender', email: 'sender@example.com' }],
    to: [{ name: 'Me', email: 'me@example.com' }],
    cc: null,
    bcc: null,
    replyTo: null,
    ...overrides,
  }
}

const defaultProps = {
  selectedEmailId: 'email-1',
  selectedEmail: createTestEmail(),
  selectedEmailIds: new Set<string>(),
  moreMenuOpen: false,
  onReply: vi.fn(),
  onReplyAll: vi.fn(),
  onForward: vi.fn(),
  onToggleFlag: vi.fn(),
  onArchive: vi.fn(),
  onDelete: vi.fn(),
  onToggleMoreMenu: vi.fn(),
  onViewSource: vi.fn(),
  onCloseMoreMenu: vi.fn(),
}

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all primary action buttons', () => {
    render(<Toolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reply All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trash' })).toBeInTheDocument()
  })

  it('disables action buttons when no email is selected', () => {
    render(<Toolbar {...defaultProps} selectedEmailId={null} selectedEmail={null} />)
    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Forward' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Star' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Trash' })).toBeDisabled()
  })

  it('enables Archive and Trash when emails are selected via bulk', () => {
    render(
      <Toolbar
        {...defaultProps}
        selectedEmailId={null}
        selectedEmail={null}
        selectedEmailIds={new Set(['email-1', 'email-2'])}
      />,
    )
    expect(screen.getByRole('button', { name: 'Archive' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Trash' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled()
  })

  it('calls onReply when Reply button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Reply' }))
    expect(defaultProps.onReply).toHaveBeenCalledTimes(1)
  })

  it('calls onToggleFlag when Star button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Star' }))
    expect(defaultProps.onToggleFlag).toHaveBeenCalledTimes(1)
  })

  it('shows "Unstar" label when email is starred', () => {
    const flaggedEmail = createTestEmail({ keywords: { $seen: true, $flagged: true } })
    render(<Toolbar {...defaultProps} selectedEmail={flaggedEmail} />)
    expect(screen.getByRole('button', { name: 'Unstar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unstar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides Reply All in mobile mode', () => {
    render(<Toolbar {...defaultProps} isMobile />)
    expect(screen.queryByRole('button', { name: 'Reply All' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument()
  })

  it('shows Back button in mobile mode when onBack provided', () => {
    const onBack = vi.fn()
    render(<Toolbar {...defaultProps} isMobile onBack={onBack} />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('opens more options menu when More button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...defaultProps} moreMenuOpen={false} />)
    const moreBtn = screen.getByRole('button', { name: 'More options' })
    await user.click(moreBtn)
    expect(defaultProps.onToggleMoreMenu).toHaveBeenCalledTimes(1)
  })

  it('renders more menu items when open', () => {
    render(<Toolbar {...defaultProps} moreMenuOpen />)
    expect(screen.getByRole('menuitem', { name: 'View Source' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Mark as Unread' })).toBeInTheDocument()
  })

  it('calls onViewSource with blobId when View Source clicked', async () => {
    const user = userEvent.setup()
    render(<Toolbar {...defaultProps} moreMenuOpen />)
    await user.click(screen.getByRole('menuitem', { name: 'View Source' }))
    expect(defaultProps.onViewSource).toHaveBeenCalledWith('blob-1')
    expect(defaultProps.onCloseMoreMenu).toHaveBeenCalledTimes(1)
  })

  it('calls onMarkUnread when Mark as Unread clicked', async () => {
    const user = userEvent.setup()
    const onMarkUnread = vi.fn()
    render(<Toolbar {...defaultProps} moreMenuOpen onMarkUnread={onMarkUnread} />)
    await user.click(screen.getByRole('menuitem', { name: 'Mark as Unread' }))
    expect(onMarkUnread).toHaveBeenCalledTimes(1)
    expect(defaultProps.onCloseMoreMenu).toHaveBeenCalledTimes(1)
  })

  it('falls back to email id when blobId is missing', async () => {
    const user = userEvent.setup()
    const emailNoBlob = createTestEmail({ blobId: '' })
    render(<Toolbar {...defaultProps} moreMenuOpen selectedEmail={emailNoBlob} />)
    await user.click(screen.getByRole('menuitem', { name: 'View Source' }))
    expect(defaultProps.onViewSource).toHaveBeenCalledWith('email-1')
  })

  it('disables More options when no email selected', () => {
    render(<Toolbar {...defaultProps} selectedEmailId={null} selectedEmail={null} />)
    expect(screen.getByRole('button', { name: 'More options' })).toBeDisabled()
  })

  it('has correct ARIA role and label on toolbar', () => {
    render(<Toolbar {...defaultProps} />)
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Email actions')
  })

  it('uses aria-expanded on More options button', () => {
    const { rerender } = render(<Toolbar {...defaultProps} moreMenuOpen={false} />)
    const moreBtn = screen.getByRole('button', { name: 'More options' })
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false')
    expect(moreBtn).toHaveAttribute('aria-haspopup', 'menu')

    rerender(<Toolbar {...defaultProps} moreMenuOpen />)
    expect(moreBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders status badge when provided', () => {
    render(<Toolbar {...defaultProps} statusBadge={<span data-testid="badge">Live</span>} />)
    expect(screen.getByTestId('badge')).toHaveTextContent('Live')
  })
})
