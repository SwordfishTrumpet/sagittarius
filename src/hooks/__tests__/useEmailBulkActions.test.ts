import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmailBulkActions } from '../useEmailBulkActions'

const {
  toastSuccess,
  moveEmailMutate,
  moveEmailBulkMutate,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  moveEmailMutate: vi.fn(),
  moveEmailBulkMutate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
  },
}))

vi.mock('../jmap/useEmailMutations', () => ({
  useEmailActions: () => ({
    moveEmail: { mutate: moveEmailMutate },
    moveEmailBulk: { mutate: moveEmailBulkMutate },
  }),
}))

describe('useEmailBulkActions', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    moveEmailMutate.mockReset()
    moveEmailBulkMutate.mockReset()
  })

  it('uses moveEmailBulk for archive undo when mailbox restore matches', () => {
    const resetSelection = vi.fn()
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        { id: 'email-1', mailboxIds: { 'mailbox-inbox': true } },
        { id: 'email-2', mailboxIds: { 'mailbox-inbox': true } },
      ],
      mailboxes: [{ id: 'mailbox-archive', role: 'archive', name: 'Archive' }],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
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

  it('uses moveEmailBulk for delete undo when mailbox restore matches', () => {
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        { id: 'email-1', mailboxIds: { 'mailbox-inbox': true } },
        { id: 'email-2', mailboxIds: { 'mailbox-inbox': true } },
      ],
      mailboxes: [{ id: 'mailbox-trash', role: 'trash', name: 'Trash' }],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
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
  })
})
