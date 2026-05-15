import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmailBulkActions } from '../useEmailBulkActions'
import { createTestEmail, createTestMailbox } from '../../test/testUtils'

const {
  toastSuccess,
  toastInfo,
  moveEmailMutate,
  moveEmailMutateAsync,
  moveEmailBulkMutate,
  moveEmailBulkMutateAsync,
  destroyEmailMutate,
  destroyEmailMutateAsync,
  destroyEmailBulkMutate,
  destroyEmailBulkMutateAsync,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  moveEmailMutate: vi.fn(),
  moveEmailMutateAsync: vi.fn(() => Promise.resolve()),
  moveEmailBulkMutate: vi.fn(),
  moveEmailBulkMutateAsync: vi.fn(() => Promise.resolve()),
  destroyEmailMutate: vi.fn(),
  destroyEmailMutateAsync: vi.fn(() => Promise.resolve()),
  destroyEmailBulkMutate: vi.fn(),
  destroyEmailBulkMutateAsync: vi.fn(() => Promise.resolve()),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    info: toastInfo,
  },
}))

vi.mock('../jmap/useEmailMutations', () => ({
  useEmailActions: () => ({
    moveEmail: { mutate: moveEmailMutate, mutateAsync: moveEmailMutateAsync },
    moveEmailBulk: { mutate: moveEmailBulkMutate, mutateAsync: moveEmailBulkMutateAsync },
    destroyEmail: { mutate: destroyEmailMutate, mutateAsync: destroyEmailMutateAsync },
    destroyEmailBulk: { mutate: destroyEmailBulkMutate, mutateAsync: destroyEmailBulkMutateAsync },
  }),
}))

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useEmailBulkActions', () => {
  beforeEach(() => {
    toastSuccess.mockReset()
    toastInfo.mockReset()
    moveEmailMutate.mockReset()
    moveEmailMutateAsync.mockReset().mockReturnValue(Promise.resolve())
    moveEmailBulkMutate.mockReset()
    moveEmailBulkMutateAsync.mockReset().mockReturnValue(Promise.resolve())
    destroyEmailMutate.mockReset()
    destroyEmailMutateAsync.mockReset().mockReturnValue(Promise.resolve())
    destroyEmailBulkMutate.mockReset()
    destroyEmailBulkMutateAsync.mockReset().mockReturnValue(Promise.resolve())
  })

  it('uses moveEmailBulk for archive undo when mailbox restore matches', async () => {
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

    await act(async () => { await flushPromises() })

    expect(moveEmailBulkMutateAsync).toHaveBeenNthCalledWith(1, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-archive': true },
    })
    expect(resetSelection).toHaveBeenCalledTimes(1)

    const undoAction = toastSuccess.mock.calls[0][1].action
    act(() => {
      undoAction.onClick()
    })

    expect(moveEmailBulkMutate).toHaveBeenNthCalledWith(1, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-inbox': true },
    })
    expect(moveEmailMutate).not.toHaveBeenCalled()
  })

  it('uses moveEmailBulk for delete when NOT in trash (move to trash)', async () => {
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-inbox': true } }),
        createTestEmail({ id: 'email-2', mailboxIds: { 'mailbox-inbox': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-trash', role: 'trash', name: 'Trash' })],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
      selectedMailboxId: 'mailbox-inbox',
      resetSelection: vi.fn(),
    }))

    act(() => {
      result.current.handleDelete()
    })

    await act(async () => { await flushPromises() })

    const undoAction = toastSuccess.mock.calls[0][1].action
    act(() => {
      undoAction.onClick()
    })

    expect(moveEmailBulkMutateAsync).toHaveBeenNthCalledWith(1, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-trash': true },
    })
    expect(moveEmailBulkMutate).toHaveBeenNthCalledWith(1, {
      emailIds: ['email-1', 'email-2'],
      mailboxIds: { 'mailbox-inbox': true },
    })
    expect(moveEmailMutate).not.toHaveBeenCalled()
    expect(destroyEmailBulkMutateAsync).not.toHaveBeenCalled()
  })

  it('uses destroyEmailBulk for permanent delete when IN trash', async () => {
    const resetSelection = vi.fn()
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-trash': true } }),
        createTestEmail({ id: 'email-2', mailboxIds: { 'mailbox-trash': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-trash', role: 'trash', name: 'Trash' })],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
      selectedMailboxId: 'mailbox-trash',
      resetSelection,
    }))

    act(() => {
      result.current.handleDelete()
    })

    await act(async () => { await flushPromises() })

    expect(destroyEmailBulkMutateAsync).toHaveBeenCalledWith({
      emailIds: ['email-1', 'email-2'],
    })
    expect(moveEmailBulkMutateAsync).not.toHaveBeenCalled()
    expect(resetSelection).toHaveBeenCalledTimes(1)

    expect(toastSuccess).toHaveBeenCalledWith(
      '2 messages permanently deleted',
      expect.any(Object)
    )
  })

  it('uses destroyEmail for single email permanent delete when IN trash', async () => {
    const resetSelection = vi.fn()
    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-trash': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-trash', role: 'trash', name: 'Deleted Items' })],
      selectedEmailId: 'email-1',
      selectedEmailIds: new Set(),
      selectedMailboxId: 'mailbox-trash',
      resetSelection,
    }))

    act(() => {
      result.current.handleDelete()
    })

    await act(async () => { await flushPromises() })

    expect(destroyEmailMutateAsync).toHaveBeenCalledWith({
      emailId: 'email-1',
    })
    expect(moveEmailMutateAsync).not.toHaveBeenCalled()
    expect(resetSelection).toHaveBeenCalledTimes(1)

    expect(toastSuccess).toHaveBeenCalledWith(
      '1 message permanently deleted',
      expect.any(Object)
    )
  })

  it('does not show success toast when mutation fails', async () => {
    moveEmailBulkMutateAsync.mockReturnValue(Promise.reject(new Error('Server error')))

    const { result } = renderHook(() => useEmailBulkActions({
      emails: [
        createTestEmail({ id: 'email-1', mailboxIds: { 'mailbox-inbox': true } }),
        createTestEmail({ id: 'email-2', mailboxIds: { 'mailbox-inbox': true } }),
      ],
      mailboxes: [createTestMailbox({ id: 'mailbox-trash', role: 'trash', name: 'Trash' })],
      selectedEmailId: null,
      selectedEmailIds: new Set(['email-1', 'email-2']),
      selectedMailboxId: 'mailbox-inbox',
      resetSelection: vi.fn(),
    }))

    act(() => {
      result.current.handleDelete()
    })

    await act(async () => { await flushPromises() })

    expect(moveEmailBulkMutateAsync).toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
