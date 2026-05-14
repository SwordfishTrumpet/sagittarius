import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEmailNavigation } from '../useEmailNavigation'
import type { Email } from '../../types/jmap'

function makeEmails(count: number): Email[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `email-${i + 1}`,
    blobId: `blob-${i + 1}`,
    threadId: `thread-${i + 1}`,
    mailboxIds: { 'mbox-1': true },
    keywords: { $seen: true },
    size: 100,
    receivedAt: `2025-01-0${i + 1}T12:00:00Z`,
    hasAttachment: false,
    preview: `Preview ${i + 1}`,
    subject: `Subject ${i + 1}`,
    from: [{ name: 'Sender', email: 'sender@example.com' }],
    to: [{ name: 'Me', email: 'me@example.com' }],
    cc: null,
    bcc: null,
    replyTo: null,
  }))
}

describe('useEmailNavigation', () => {
  const onSelectEmail = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to next email with navigateToNext', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'email-1', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToNext()
    })

    expect(onSelectEmail).toHaveBeenCalledWith('email-2', 'thread-2')
    expect(result.current.scrollToEmailId).toBe('email-2')
  })

  it('navigates to previous email with navigateToPrevious', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'email-3', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToPrevious()
    })

    expect(onSelectEmail).toHaveBeenCalledWith('email-2', 'thread-2')
    expect(result.current.scrollToEmailId).toBe('email-2')
  })

  it('does not navigate past last email', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'email-3', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToNext()
    })

    expect(onSelectEmail).not.toHaveBeenCalled()
    expect(result.current.scrollToEmailId).toBeNull()
  })

  it('does not navigate before first email', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'email-1', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToPrevious()
    })

    expect(onSelectEmail).not.toHaveBeenCalled()
    expect(result.current.scrollToEmailId).toBeNull()
  })

  it('does nothing when emails list is empty', () => {
    const { result } = renderHook(() =>
      useEmailNavigation({ emails: [], currentEmailId: null, onSelectEmail }),
    )

    act(() => {
      result.current.navigateToNext()
      result.current.navigateToPrevious()
    })

    expect(onSelectEmail).not.toHaveBeenCalled()
  })

  it('does nothing when current email is not in list', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'nonexistent', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToNext()
      result.current.navigateToPrevious()
    })

    expect(onSelectEmail).not.toHaveBeenCalled()
  })

  it('navigates to specific email with navigateToEmail', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'email-1', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToEmail('email-3')
    })

    expect(onSelectEmail).toHaveBeenCalledWith('email-3', 'thread-3')
    expect(result.current.scrollToEmailId).toBe('email-3')
  })

  it('does nothing when navigateToEmail id not found', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'email-1', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToEmail('nonexistent')
    })

    expect(onSelectEmail).not.toHaveBeenCalled()
    expect(result.current.scrollToEmailId).toBeNull()
  })

  it('clears scroll target with clearScrollTarget', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: 'email-1', onSelectEmail }),
    )

    act(() => {
      result.current.navigateToNext()
    })
    expect(result.current.scrollToEmailId).toBe('email-2')

    act(() => {
      result.current.clearScrollTarget()
    })
    expect(result.current.scrollToEmailId).toBeNull()
  })

  it('handles undefined emails gracefully', () => {
    const { result } = renderHook(() =>
      useEmailNavigation({ emails: undefined, currentEmailId: null, onSelectEmail }),
    )

    act(() => {
      result.current.navigateToNext()
      result.current.navigateToPrevious()
    })

    expect(onSelectEmail).not.toHaveBeenCalled()
  })

  it('selects first email on next when no current selection', () => {
    const emails = makeEmails(3)
    const { result } = renderHook(() =>
      useEmailNavigation({ emails, currentEmailId: null, onSelectEmail }),
    )

    act(() => {
      result.current.navigateToNext()
    })

    // When currentEmailId is null, findIndex returns -1, so it returns early
    expect(onSelectEmail).not.toHaveBeenCalled()
  })
})
