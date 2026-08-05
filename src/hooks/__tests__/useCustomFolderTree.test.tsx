/**
 * useCustomFolderTree tests — BUG-2026-025 (reject reparenting a folder into
 * itself or a descendant) and BUG-2026-027 (sortOrder numbering must not
 * collide with system folder orders).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createTestMailbox } from '../../test/testUtils'

const { reparentMutate, reorderMutate } = vi.hoisted(() => ({
  reparentMutate: vi.fn(),
  reorderMutate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../jmap/useMailboxes', () => ({
  useMailboxReorder: () => ({
    reorderMailbox: { mutate: reorderMutate },
    reparentMailbox: { mutate: reparentMutate },
  }),
}))

import { useCustomFolderTree } from '../useCustomFolderTree'
import { toast } from 'sonner'
import type { Mailbox } from '../../types/jmap'

// System folders occupy low sortOrders (1-3); custom folders start at 4+.
const SYSTEM_MAILBOXES: Mailbox[] = [
  createTestMailbox({ id: 'sys-inbox', name: 'Inbox', role: 'inbox', sortOrder: 1 }),
  createTestMailbox({ id: 'sys-sent', name: 'Sent', role: 'sent', sortOrder: 2 }),
  createTestMailbox({ id: 'sys-trash', name: 'Trash', role: 'trash', sortOrder: 3 }),
]

const CUSTOM_MAILBOXES: Mailbox[] = [
  createTestMailbox({ id: 'a', name: 'Projects', sortOrder: 4 }),
  createTestMailbox({ id: 'b', name: 'Sagittarius', parentId: 'a', sortOrder: 5 }),
  // NOTE: do NOT name fixtures after well-known roles (Archive, Inbox, …) —
  // classifyMailboxes maps those names to system mailboxes.
  createTestMailbox({ id: 'c', name: 'Work', sortOrder: 6 }),
]

const ALL_MAILBOXES = [...SYSTEM_MAILBOXES, ...CUSTOM_MAILBOXES]

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return Wrapper
}

describe('useCustomFolderTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects reparenting a folder into itself (BUG-2026-025)', () => {
    const { result } = renderHook(() => useCustomFolderTree(ALL_MAILBOXES), { wrapper: makeWrapper() })

    act(() => {
      result.current.handleMailboxReparent('a', 'a')
    })

    expect(reparentMutate).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Cannot move a folder into itself or its own subfolder')
  })

  it('rejects reparenting a folder into one of its descendants (BUG-2026-025)', () => {
    const { result } = renderHook(() => useCustomFolderTree(ALL_MAILBOXES), { wrapper: makeWrapper() })

    // 'b' is a child of 'a'; moving 'a' into 'b' would create a cycle
    act(() => {
      result.current.handleMailboxReparent('a', 'b')
    })

    expect(reparentMutate).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Cannot move a folder into itself or its own subfolder')
  })

  it('allows reparenting into an unrelated folder', () => {
    const { result } = renderHook(() => useCustomFolderTree(ALL_MAILBOXES), { wrapper: makeWrapper() })

    act(() => {
      result.current.handleMailboxReparent('c', 'a')
    })

    expect(reparentMutate).toHaveBeenCalledWith({ mailboxId: 'c', newParentId: 'a' })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('numbers custom folders after the max system sortOrder on reorder (BUG-2026-027)', () => {
    const { result } = renderHook(() => useCustomFolderTree(ALL_MAILBOXES), { wrapper: makeWrapper() })

    // Reorder 'c' (Archive) before 'a' (Projects): custom order becomes c, a, b
    act(() => {
      result.current.handleMailboxReorder('c', 'a')
    })

    expect(reorderMutate).toHaveBeenCalledTimes(1)
    const updates = reorderMutate.mock.calls[0][0] as Array<{ mailboxId: string; sortOrder: number }>
    // System folders own sortOrder 1-3; custom folders must start at 4.
    expect(updates.map(u => u.sortOrder)).toEqual([4, 5, 6])
    // The dragged folder lands first
    expect(updates[0].mailboxId).toBe('c')
  })
})
