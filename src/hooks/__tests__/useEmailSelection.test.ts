import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEmailSelection } from '../useEmailSelection'
import type { Email } from '../../types/jmap'

// Mock test data
const createMockEmail = (id: string, threadId: string): Email => ({
  id,
  blobId: `blob-${id}`,
  threadId,
  subject: `Email ${id}`,
  preview: `Preview ${id}`,
  receivedAt: new Date().toISOString(),
  from: [{ email: 'test@example.com', name: 'Test User' }],
  to: [{ email: 'recipient@example.com', name: 'Recipient' }],
  cc: null,
  bcc: null,
  replyTo: null,
  mailboxIds: { 'inbox': true },
  keywords: {},
  size: 1000,
  hasAttachment: false,
})

describe('useEmailSelection', () => {
  const mockEmails: Email[] = [
    createMockEmail('email-1', 'thread-1'),
    createMockEmail('email-2', 'thread-2'),
    createMockEmail('email-3', 'thread-3'),
    createMockEmail('email-4', 'thread-4'),
    createMockEmail('email-5', 'thread-5'),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should select single email on regular click', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.toggleEmailSelection('email-2', false, false)
    })

    expect(result.current.selectedEmailId).toBe('email-2')
    expect(result.current.selectedEmailIds.has('email-2')).toBe(true)
    expect(result.current.selectedEmailIds.size).toBe(1)
  })

  it('should toggle selection with Ctrl+click', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.toggleEmailSelection('email-1', false, false)
    })

    act(() => {
      result.current.toggleEmailSelection('email-2', true, false)
    })

    expect(result.current.selectedEmailIds.has('email-1')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-2')).toBe(true)
    expect(result.current.selectedEmailIds.size).toBe(2)

    // Toggle off
    act(() => {
      result.current.toggleEmailSelection('email-1', true, false)
    })

    expect(result.current.selectedEmailIds.has('email-1')).toBe(false)
    expect(result.current.selectedEmailIds.has('email-2')).toBe(true)
  })

  it('should select range with Shift+click using anchor ref pattern (BUG 12 fix)', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    // First click sets anchor
    act(() => {
      result.current.toggleEmailSelection('email-2', false, false)
    })

    expect(result.current.selectedEmailId).toBe('email-2')

    // Shift+click to select range from anchor
    act(() => {
      result.current.toggleEmailSelection('email-4', false, true)
    })

    // Should select all emails from 2 to 4
    expect(result.current.selectedEmailIds.has('email-2')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-3')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-4')).toBe(true)
    expect(result.current.selectedEmailIds.size).toBe(3)
  })

  it('should handle rapid Shift+clicks without race condition (BUG 12 fix)', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    // First click sets anchor
    act(() => {
      result.current.toggleEmailSelection('email-1', false, false)
    })

    // Rapid Shift+clicks - anchor should remain email-1
    act(() => {
      result.current.toggleEmailSelection('email-3', false, true)
    })

    act(() => {
      result.current.toggleEmailSelection('email-5', false, true)
    })

    // Second Shift+click should use original anchor (email-1), not email-3
    // So we should have range from 1 to 5 selected
    expect(result.current.selectedEmailIds.has('email-1')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-2')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-3')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-4')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-5')).toBe(true)
    expect(result.current.selectedEmailIds.size).toBe(5)
  })

  it('should update anchor on regular click between Shift selections', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    // First click
    act(() => {
      result.current.toggleEmailSelection('email-1', false, false)
    })

    // Shift+click to select 1-3
    act(() => {
      result.current.toggleEmailSelection('email-3', false, true)
    })

    // Regular click on email-3 to update anchor
    act(() => {
      result.current.toggleEmailSelection('email-3', false, false)
    })

    // Shift+click to select from new anchor (3) to 5
    act(() => {
      result.current.toggleEmailSelection('email-5', false, true)
    })

    // Should now have email-3, 4, 5 selected (regular click cleared previous)
    expect(result.current.selectedEmailIds.has('email-3')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-4')).toBe(true)
    expect(result.current.selectedEmailIds.has('email-5')).toBe(true)
    expect(result.current.selectedEmailIds.size).toBe(3)
  })

  it('should handle empty emails array gracefully', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: undefined }))

    act(() => {
      result.current.toggleEmailSelection('email-1', false, false)
    })

    expect(result.current.selectedEmailId).toBe('email-1')
    // No error should be thrown
  })

  it('should select all emails', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.selectAllEmails()
    })

    expect(result.current.selectedEmailIds.size).toBe(5)
    mockEmails.forEach(email => {
      expect(result.current.selectedEmailIds.has(email.id)).toBe(true)
    })
  })

  it('should clear selection', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.selectAllEmails()
    })

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.selectedEmailIds.size).toBe(0)
  })

  it('should reset selection and clear anchor ref (BUG 12 fix)', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.toggleEmailSelection('email-2', false, false)
    })

    act(() => {
      result.current.resetSelection()
    })

    expect(result.current.selectedEmailId).toBeNull()
    expect(result.current.selectedThreadId).toBeNull()
    expect(result.current.selectedEmailIds.size).toBe(0)

    // After reset, Shift+click should not select a range since anchor is null
    act(() => {
      result.current.toggleEmailSelection('email-4', false, true)
    })

    // Should only select email-4, not a range
    expect(result.current.selectedEmailIds.size).toBe(1)
    expect(result.current.selectedEmailIds.has('email-4')).toBe(true)
  })

  it('should return selected email object', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.toggleEmailSelection('email-3', false, false)
    })

    expect(result.current.selectedEmail).toEqual(mockEmails[2])
  })

  it('should set selected email ID and thread ID programmatically', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.setSelectedEmailId('email-4')
    })

    expect(result.current.selectedEmailId).toBe('email-4')
    expect(result.current.selectedThreadId).toBe('thread-4')
  })

  it('should set thread ID programmatically', () => {
    const { result } = renderHook(() => useEmailSelection({ emails: mockEmails }))

    act(() => {
      result.current.setSelectedThreadId('custom-thread')
    })

    expect(result.current.selectedThreadId).toBe('custom-thread')
  })
})
