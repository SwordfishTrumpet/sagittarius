import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmailBulkActions } from '../useEmailBulkActions'
import { createTestEmail, createTestMailbox } from '../../test/testUtils'

const {
  toastSuccess,
  toastInfo,
  moveEmailMutate,
  moveEmailBulkMutate,
  destroyEmailMutate,
  destroyEmailBulkMutate,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  moveEmailMutate: vi.fn(),
  moveEmailBulkMutate: vi.fn(),
  destroyEmailMutate: vi.fn(),
  destroyEmailBulkMutate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    info: toastInfo,
  },
}))

vi.mock('../jmap/useEmailMutations', () => ({
  useEmailActions: () => ({
    moveEmail: { mutate: moveEmailMutate },
    moveEmailBulk: { mutate: moveEmailBulkMutate },
    destroyEmail: { mutate: destroyEmailMutate },
    destroyEmailBulk: { mutate: destroyEmailBulkMutate },
  }),
}))

describe('useEmailBulkActions', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    toastInfo.mockReset()
    moveEmailMutate.mockReset()
    moveEmailBulkMutate.mockReset()
    destroyEmailMutate.mockReset()
    destroyEmailBulkMutate.mockReset()
  })

  it('uses moveEmailBulk for archive undo when mailbox restore matches', () => {
    const resetSelection = vi.fn()
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-inbox': true } }),
        createTestEmail({ id: 'email-2', mailboxIds: { 'mailbox-inbox': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-archive', role: 'archive', name: 'Archive' })],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
      selectedMailboxId: 'mailbox-inbox',
      resetSelection,
    }))

    act(() => {
      result.current.handleArchive()
    })

    expect(moveEmailBulkMutate).toHaveBeenNthCalledWith(1, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-archive': true },
    })
    expect(resetSelection).toHaveBeenCalledTimes(1)

    const undoAction = toastSuccess.mock.calls[0][1].action
    act(() => {
      undoAction.onClick()
    })

    expect(moveEmailBulkMutate).toHaveBeenNthCalledWith(2, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-inbox': true },
    })
    expect(moveEmailMutate).not.toHaveBeenCalled()
  })

  it('uses moveEmailBulk for delete when NOT in trash (move to trash)', () => {
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-inbox': true } }),
        createTestEmail({ id: 'email-2', mailboxIds: { 'mailbox-inbox': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-trash', role: 'trash', name: 'Trash' })],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
      selectedMailboxId: 'mailbox-inbox', // NOT in trash
      resetSelection: vi.fn(),
    }))

    act(() => {
      result.current.handleDelete()
    })

    const undoAction = toastSuccess.mock.calls[0][1].action
    act(() => {
      undoAction.onClick()
    })

    expect(moveEmailBulkMutate).toHaveBeenNthCalledWith(1, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-trash': true },
    })
    expect(moveEmailBulkMutate).toHaveBeenNthCalledWith(2, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-inbox': true },
    })
    expect(moveEmailMutate).not.toHaveBeenCalled()
    expect(destroyEmailBulkMutate).not.toHaveBeenCalled()
  })

  it('uses destroyEmailBulk for permanent delete when IN trash', () => {
    const resetSelection = vi.fn()
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-trash': true } }),
        createTestEmail({ id: 'email-2', mailboxIds: { 'mailbox-trash': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-trash', role: 'trash', name: 'Trash' })],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
      selectedMailboxId: 'mailbox-trash', // IN trash
      resetSelection,
    }))

    act(() => {
      result.current.handleDelete()
    })

    expect(destroyEmailBulkMutate).toHaveBeenCalledWith({
      emailIds: ['email-1', 'email-2'],
    })
    expect(moveEmailBulkMutate).not.toHaveBeenCalled()
    expect(resetSelection).toHaveBeenCalledTimes(1)

    // Verify toast shows "permanently deleted" message
    expect(toastSuccess).toHaveBeenCalledWith(
      '2 messages permanently deleted',
      expect.any(Object)
    )
  })

  it('uses destroyEmail for single email permanent delete when IN trash', () => {
    const resetSelection = vi.fn()
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-trash': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-trash', role: 'trash', name: 'Deleted Items' })],
      selectedEmailId: 'email-1',
      selectedEmailIds: new Set(),
      selectedMailboxId: 'mailbox-trash', // IN trash (Deleted Items)
      resetSelection,
    }))

    act(() => {
      result.current.handleDelete()
    })

    expect(destroyEmailMutate).toHaveBeenCalledWith({
      emailId: 'email-1',
    })
    expect(moveEmailMutate).not.toHaveBeenCalled()
    expect(resetSelection).toHaveBeenCalledTimes(1)

    // Verify toast shows "permanently deleted" message
    expect(toastSuccess).toHaveBeenCalledWith(
      '1 message permanently deleted',
      expect.any(Object)
    )
  })
})
