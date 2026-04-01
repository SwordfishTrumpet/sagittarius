import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../Sidebar'

vi.mock('react-dnd', () => ({
  useDrop: (factory: () => any) => {
    const monitor = { isOver: () => false, canDrop: () => false }
    const config = factory()
    return [config.collect?.(monitor) || { isOver: false, canDrop: false }, vi.fn()]
  },
  useDrag: (factory: () => any) => {
    const monitor = { isDragging: () => false }
    const config = factory()
    return [config.collect?.(monitor) || { isDragging: false }, vi.fn()]
  },
}))

const baseProps = {
  session: { username: 'user@example.com' },
  userLabel: 'user',
  mailboxes: [
    { id: 'inbox', name: 'Inbox', role: 'inbox', unreadEmails: 1 },
  ],
  mailboxesLoading: false,
  refetchMailboxes: vi.fn(),
  selectedMailboxId: null,
  isAnyPaneResizing: false,
  sidebarWidth: 260,
  expandedSections: { mailboxes: true, folders: true },
  customFolderTree: [],
  hasNewMail: false,
  esConnected: true,
  isOffline: false,
  quota: null,
  onToggleSidebarCollapsed: vi.fn(),
  onCompose: vi.fn(),
  onSelectMailbox: vi.fn(),
  onClearNewMail: vi.fn(),
  onMailboxContextMenu: vi.fn(),
  onMoveEmailsToFolder: vi.fn(),
  onToggleSectionExpanded: vi.fn(),
  onCreateFolder: vi.fn(),
  onToggleFolderExpanded: vi.fn(),
  onRenameMailbox: vi.fn(),
  onDeleteMailbox: vi.fn(),
  onReorderMailbox: vi.fn(),
  onReparentMailbox: vi.fn(),
  onOpenSettings: vi.fn(),
  resetSelection: vi.fn(),
  setSelectedMailboxId: vi.fn(),
  setSelectedFolderId: vi.fn(),
  setSelectedFolderName: vi.fn(),
}

describe('Sidebar', () => {
  it('removes interactive sidebar content from the DOM when collapsed', () => {
    render(<Sidebar {...baseProps} isSidebarCollapsed />)

    expect(screen.getByLabelText('Mailbox navigation')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button', { name: 'Compose message' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Mailboxes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('renders interactive sidebar content when expanded', () => {
    render(<Sidebar {...baseProps} isSidebarCollapsed={false} />)

    expect(screen.getByRole('button', { name: 'Compose message' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Mailboxes' })).toBeInTheDocument()
  })

  it('shows the local-part user label in the footer', () => {
    render(<Sidebar {...baseProps} isSidebarCollapsed={false} />)

    expect(screen.getByText('user')).toBeInTheDocument()
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
  })

  it('shows offline cache status when disconnected from the network', () => {
    render(<Sidebar {...baseProps} isSidebarCollapsed={false} isOffline />)

    expect(screen.getByText('Offline cache')).toBeInTheDocument()
  })
})
