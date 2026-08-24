/**
 * Regression tests for BUG-2026-055 — moving a folder via the context-menu
 * "Move to…" flow used to fire TWO success toasts for one action:
 * one in useFolderDialogs.handleMoveToFolder and another inside
 * useCustomFolderTree.handleMailboxReparent (which drag-drop also uses).
 *
 * The dialog path must NOT toast on success anymore; the shared reparent
 * handler owns the toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFolderDialogs } from '../useFolderDialogs'

const { reparentSpy, toastError, toastSuccess } = vi.hoisted(() => ({
  reparentSpy: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

let lastMenuItems: Array<{ id: string; label: string; onSelect?: () => void }> = []

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...(args as [])),
    error: (...args: unknown[]) => toastError(...(args as [])),
  },
}))

vi.mock('../jmap/useMailboxes', () => ({
  useMailboxActions: () => ({
    createMailbox: { mutate: vi.fn() },
    renameMailbox: { mutate: vi.fn() },
    deleteMailbox: { mutate: vi.fn() },
    reorderMailbox: { mutate: vi.fn() },
    reparentMailbox: { mutate: reparentSpy },
  }),
}))

vi.mock('../../components/ContextMenu', () => ({
  ContextMenu: ({ items }: { items: Array<{ id: string; label: string; onSelect?: () => void }> }) => {
    lastMenuItems = items
    return <div data-testid="context-menu-stub" />
  },
}))

vi.mock('../../components/dialogs/CreateFolderDialog', () => ({ CreateFolderDialog: () => null }))
vi.mock('../../components/dialogs/RenameFolderDialog', () => ({ RenameFolderDialog: () => null }))
vi.mock('../../components/dialogs/DeleteFolderDialog', () => ({ DeleteFolderDialog: () => null }))

import type { Mailbox } from '../../types/jmap'

const mailboxes: Mailbox[] = [
  {
    id: 'parent-1',
    name: 'Projects',
    parentId: null,
    role: null,
    sortOrder: 0,
    totalEmails: 0,
    unreadEmails: 0,
    totalThreads: 0,
    unreadThreads: 0,
    isSubscribed: true,
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: true,
      mayDelete: true,
      maySubmit: true,
    },
  },
]

function Harness({ onReparent }: { onReparent: (draggedId: string, newParentId: string | null) => void }) {
  const hooks = useFolderDialogs({
    selectedMailboxId: null,
    setSelectedMailboxId: vi.fn(),
    mailboxes,
    onReparentMailbox: onReparent,
  })
  const Dialogs = hooks.FolderDialogsUI
  return (
    <div>
      <button onClick={(e) => hooks.handleMailboxContextMenu('child-1', 'Work', e)}>open-menu</button>
      <Dialogs />
    </div>
  )
}

describe('useFolderDialogs move-to-folder (BUG-2026-055)', () => {
  const createTestQueryClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

  beforeEach(() => {
    vi.clearAllMocks()
    lastMenuItems = []
    vi.stubGlobal('prompt', vi.fn(() => 'Projects'))
  })

  it('delegates the reparent and does NOT stack a second success toast', async () => {
    const user = userEvent.setup()
    const onReparent = vi.fn()

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Harness onReparent={onReparent} />
      </QueryClientProvider>,
    )

    await user.click(screen.getByText('open-menu'))
    const moveToItem = lastMenuItems.find((item) => item.id === 'move')
    expect(moveToItem).toBeTruthy()
    await user.click(screen.getByTestId('context-menu-stub'))
    moveToItem!.onSelect!()

    // Reparent delegated to the shared handler (which owns the toast)
    expect(onReparent).toHaveBeenCalledWith('child-1', 'parent-1')
    // Regression: no additional success toast from the dialog path itself.
    // The only allowed success toast comes from useCustomFolderTree.
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('still surfaces an error when the target folder name is unknown', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('prompt', vi.fn(() => 'NoSuchFolder'))

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Harness onReparent={vi.fn()} />
      </QueryClientProvider>,
    )

    await user.click(screen.getByText('open-menu'))
    const moveToItem = lastMenuItems.find((item) => item.id === 'move')
    await user.click(screen.getByTestId('context-menu-stub'))
    moveToItem!.onSelect!()

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('NoSuchFolder'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
