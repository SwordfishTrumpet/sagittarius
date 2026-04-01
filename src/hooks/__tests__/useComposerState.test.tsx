import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useComposerState } from '../useComposerState'

const STORAGE_PREFIX = 'sagittarius_composer_draft'

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount: () => 'account-1',
  },
}))

vi.mock('./jmap/useEmailQueries', () => ({
  fetchEmailWithBody: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('useComposerState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clears localStorage draft when opening new composer', () => {
    // The key format is: sagittarius_composer_draft:{accountId}:new
    const key = `${STORAGE_PREFIX}:account-1:new`
    
    // Pre-populate localStorage with a draft
    localStorage.setItem(key, JSON.stringify({
      to: 'old@example.com',
      subject: 'Old draft',
      body: '<p>Old body</p>',
      cc: '',
      bcc: '',
      attachments: [],
      selectedIdentityId: null,
      showCcBcc: false,
      sendAt: null,
      isQuoteCollapsed: false,
    }))
    
    expect(localStorage.getItem(key)).not.toBeNull()
    
    const { result } = renderHook(() => useComposerState())
    
    // Open new composer
    act(() => {
      result.current.openComposer()
    })
    
    // localStorage should be cleared
    expect(localStorage.getItem(key)).toBeNull()
    expect(result.current.isComposerOpen).toBe(true)
    expect(result.current.replyToEmail).toBeNull()
    expect(result.current.draftEmail).toBeNull()
  })

  it('does not clear localStorage for replies', () => {
    // Reply context generates a different key
    const replyKey = `${STORAGE_PREFIX}:account-1:reply:email-1`
    
    // Pre-populate localStorage with a reply draft
    localStorage.setItem(replyKey, JSON.stringify({
      to: 'reply@example.com',
      subject: 'Re: Something',
      body: '<p>Reply body</p>',
      cc: '',
      bcc: '',
      attachments: [],
      selectedIdentityId: null,
      showCcBcc: false,
      sendAt: null,
      isQuoteCollapsed: false,
    }))
    
    const { result } = renderHook(() => useComposerState())
    
    // Open reply composer
    act(() => {
      result.current.handleReply({
        id: 'email-2',
        threadId: 'thread-1',
        subject: 'New subject',
        from: [{ email: 'sender@example.com' }],
      })
    })
    
    // Different key, so original reply draft should remain
    expect(result.current.isComposerOpen).toBe(true)
    // Note: handleReply doesn't clear localStorage for its specific key,
    // it just sets up reply state. The reply draft key is different anyway.
    expect(localStorage.getItem(replyKey)).not.toBeNull()
  })
})
