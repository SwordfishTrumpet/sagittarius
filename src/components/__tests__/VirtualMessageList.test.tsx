import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { VirtualMessageList } from '../VirtualMessageList'
import { createTestEmail, createTestMailbox } from '../../test/testUtils'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

vi.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, vi.fn()],
}))

vi.mock('react-virtuoso', () => ({
  Virtuoso: forwardRef<any, any>(function VirtuosoMock({ data = [], itemContent, ...props }, ref) {
    return (
      <div ref={ref} {...props}>
        {data.map((item: any, index: number) => (
          <div key={item.id}>{itemContent(index, item)}</div>
        ))}
      </div>
    )
  }),
}))

describe('VirtualMessageList draft behavior', () => {
  it('reopens draft messages on double click', async () => {
    const user = userEvent.setup()
    const onToggleSelection = vi.fn()
    const onOpenDraft = vi.fn()

    render(
      <VirtualMessageList
        emails={[
          createTestEmail({
            id: 'draft-1',
            threadId: 'thread-1',
            from: [{ email: 'user@example.com' }],
            subject: 'Draft subject',
            preview: 'Draft preview',
            receivedAt: '2026-04-01T10:00:00.000Z',
            keywords: { '$draft': true },
            mailboxIds: { 'mailbox-drafts': true },
          }),
        ]}
        isLoading={false}
        isRefetching={false}
        selectedEmailId={null}
        selectedEmailIds={new Set()}
        mailboxes={[]}
        onToggleSelection={onToggleSelection}
        onToggleFlag={vi.fn()}
        formatMessageDate={() => 'Apr 1'}
        onOpenDraft={onOpenDraft}
      />,
    )

    await user.dblClick(screen.getByLabelText(/Draft subject/))

    expect(onToggleSelection).toHaveBeenCalledWith('draft-1', false, false)
    expect(onOpenDraft).toHaveBeenCalledWith('draft-1')
  })
})

describe('VirtualMessageList context menu', () => {
  const mockEmails = [
    createTestEmail({
      id: 'email-1',
      threadId: 'thread-1',
      subject: 'Test Subject',
      preview: 'Test preview',
      receivedAt: '2026-04-01T10:00:00.000Z',
      keywords: {},
    }),
  ]

  const mockMailboxes = [
    createTestMailbox({ id: 'inbox', name: 'Inbox', role: 'inbox' }),
    createTestMailbox({ id: 'archive', name: 'Archive', role: 'archive' }),
  ]

  const defaultProps = {
    emails: mockEmails,
    isLoading: false,
    isRefetching: false,
    selectedEmailId: null,
    selectedEmailIds: new Set<string>(),
    mailboxes: mockMailboxes,
    onToggleSelection: vi.fn(),
    onToggleFlag: vi.fn(),
    formatMessageDate: () => 'Apr 1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any context menus
    document.body.innerHTML = ''
  })

  it('calls onReply when Reply is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()

    render(<VirtualMessageList {...defaultProps} onReply={onReply} />)

    // Right-click on the email
    const emailRow = screen.getByLabelText(/Test Subject/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    // Context menu should appear - use exact match for "Reply" only
    const replyButton = await screen.findByRole('menuitem', { name: 'Reply' })
    await user.click(replyButton)

    expect(onReply).toHaveBeenCalledWith('email-1')
  })

  it('calls onReplyAll when Reply All is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onReplyAll = vi.fn()

    render(<VirtualMessageList {...defaultProps} onReplyAll={onReplyAll} />)

    const emailRow = screen.getByLabelText(/Test Subject/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    const replyAllButton = await screen.findByRole('menuitem', { name: 'Reply All' })
    await user.click(replyAllButton)

    expect(onReplyAll).toHaveBeenCalledWith('email-1')
  })

  it('calls onForward when Forward is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onForward = vi.fn()

    render(<VirtualMessageList {...defaultProps} onForward={onForward} />)

    const emailRow = screen.getByLabelText(/Test Subject/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    const forwardButton = await screen.findByRole('menuitem', { name: 'Forward' })
    await user.click(forwardButton)

    expect(onForward).toHaveBeenCalledWith('email-1')
  })

  it('calls onArchive when Archive is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onArchive = vi.fn()

    render(<VirtualMessageList {...defaultProps} onArchive={onArchive} />)

    const emailRow = screen.getByLabelText(/Test Subject/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    const archiveButton = await screen.findByRole('menuitem', { name: 'Archive' })
    await user.click(archiveButton)

    expect(onArchive).toHaveBeenCalledWith('email-1')
  })

  it('calls onDelete when Trash is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    render(<VirtualMessageList {...defaultProps} onDelete={onDelete} />)

    const emailRow = screen.getByLabelText(/Test Subject/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    const trashButton = await screen.findByRole('menuitem', { name: 'Trash' })
    await user.click(trashButton)

    expect(onDelete).toHaveBeenCalledWith('email-1')
  })

  it('calls onToggleFlag when Flag is clicked in context menu', async () => {
    const user = userEvent.setup()
    const onToggleFlag = vi.fn()

    render(<VirtualMessageList {...defaultProps} onToggleFlag={onToggleFlag} />)

    const emailRow = screen.getByLabelText(/Test Subject/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    const flagButton = await screen.findByRole('menuitem', { name: 'Flag' })
    await user.click(flagButton)

    expect(onToggleFlag).toHaveBeenCalledWith('email-1', false)
  })

  it('calls onToggleFlag with correct flagged state when unflagging', async () => {
    const user = userEvent.setup()
    const onToggleFlag = vi.fn()

    const flaggedEmail = createTestEmail({
      id: 'email-2',
      threadId: 'thread-2',
      subject: 'Flagged Email',
      preview: 'Preview',
      receivedAt: '2026-04-01T10:00:00.000Z',
      keywords: { '$flagged': true },
    })

    render(
      <VirtualMessageList
        {...defaultProps}
        emails={[flaggedEmail]}
        onToggleFlag={onToggleFlag}
      />
    )

    const emailRow = screen.getByLabelText(/Flagged Email/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    const unflagButton = await screen.findByRole('menuitem', { name: 'Unflag' })
    await user.click(unflagButton)

    expect(onToggleFlag).toHaveBeenCalledWith('email-2', true)
  })

  it('does not call handlers when actions are not provided', async () => {
    const user = userEvent.setup()

    // Render without action handlers - should not throw
    render(<VirtualMessageList {...defaultProps} />)

    const emailRow = screen.getByLabelText(/Test Subject/)
    await user.pointer({ target: emailRow, keys: '[MouseRight]' })

    // Menu items should still appear - use exact name match
    expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()

    // Clicking should close menu without throwing
    const replyButton = screen.getByRole('menuitem', { name: 'Reply' })
    await user.click(replyButton)

    // Menu should close
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })
})
