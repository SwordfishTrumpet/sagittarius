import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useAttachmentDeduplication,
  useIsAttachmentDuplicated,
  useAttachmentReferences,
  formatBytes,
  getDeduplicationStatusText,
  getDeduplicationStatusColor,
} from '../useAttachmentDeduplication'
import type { Email, EmailBodyPart } from '../../types/jmap'
import type { BlobLookupResponse } from '../../types/jmap-blob'

const { request, getPrimaryAccount, hasBlobCapability, lookupBlobs } = vi.hoisted(() => ({
  request: vi.fn(),
  getPrimaryAccount: vi.fn().mockReturnValue('account-1'),
  hasBlobCapability: vi.fn().mockReturnValue(true),
  lookupBlobs: vi.fn(),
}))

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    request,
    getPrimaryAccount,
    hasBlobCapability,
    lookupBlobs,
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<unknown>; queryKey: unknown[]; enabled?: boolean }) => {
    const [data, setData] = vi.mocked(require('react').useState)(undefined)
    const [isLoading, setIsLoading] = vi.mocked(require('react').useState)(false)
    const [error, setError] = vi.mocked(require('react').useState)(null)
    const [isSuccess, setIsSuccess] = vi.mocked(require('react').useState)(false)
    
    vi.mocked(require('react').useEffect)(() => {
      if (options.enabled === false) return
      setIsLoading(true)
      options.queryFn()
        .then((result: unknown) => {
          setData(result)
          setIsSuccess(true)
          setIsLoading(false)
        })
        .catch((err: Error) => {
          setError(err)
          setIsLoading(false)
        })
    }, [options.queryKey.join(',')])
    
    return { data, isLoading, error, isSuccess, isEnabled: options.enabled !== false }
  },
}))

describe('useAttachmentDeduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPrimaryAccount.mockReturnValue('account-1')
    hasBlobCapability.mockReturnValue(true)
  })

  it('should return empty result when no duplicates found', async () => {
    // Mock empty email list response
    request.mockResolvedValueOnce({
      methodResponses: [
        ['Email/query', { ids: [] }, '0'],
        ['Email/get', { list: [] }, '1'],
      ],
    })

    const { result } = renderHook(() => useAttachmentDeduplication())

    await waitFor(() => {
      expect(result.current.data).toEqual({
        duplicates: [],
        duplicateCount: 0,
        totalPotentialSavings: 0,
        totalRedundantReferences: 0,
      })
    })
  })

  it('should identify duplicate attachments', async () => {
    const mockAttachment: EmailBodyPart = {
      blobId: 'blob-123',
      name: 'document.pdf',
      type: 'application/pdf',
      size: 1024000,
      partId: 'part-1',
    }

    const mockEmail: Email = {
      id: 'email-1',
      blobId: 'email-blob-1',
      threadId: 'thread-1',
      mailboxIds: { inbox: true },
      keywords: {},
      size: 1024000,
      receivedAt: '2026-04-02T10:00:00Z',
      hasAttachment: true,
      preview: 'Email with attachment',
      subject: 'Test Email',
      from: [{ name: 'Sender', email: 'sender@example.com' }],
      to: [{ name: 'Recipient', email: 'recipient@example.com' }],
      cc: null,
      bcc: null,
      replyTo: null,
      attachments: [mockAttachment],
    }

    // Mock Email/query + Email/get response
    request.mockResolvedValueOnce({
      methodResponses: [
        ['Email/query', { ids: ['email-1', 'email-2'] }, 'queryEmails0'],
        ['Email/get', { list: [mockEmail, { ...mockEmail, id: 'email-2' }] }, 'getEmails0'],
      ],
    })

    // Mock Blob/lookup response showing the blob is referenced by 2 emails
    const mockLookupResponse: BlobLookupResponse = {
      accountId: 'account-1',
      list: [
        {
          id: 'blob-123',
          matchedIds: {
            Email: ['email-1', 'email-2'],
          },
        },
      ],
    }
    lookupBlobs.mockResolvedValueOnce(mockLookupResponse)

    const { result } = renderHook(() => useAttachmentDeduplication())

    await waitFor(() => {
      expect(result.current.data?.duplicateCount).toBe(1)
      expect(result.current.data?.duplicates[0].referenceCount).toBe(2)
      expect(result.current.data?.duplicates[0].potentialSavings).toBe(1024000) // size * (2-1)
    })
  })

  it('should disable query when server lacks blob capability', async () => {
    hasBlobCapability.mockReturnValue(false)

    const { result } = renderHook(() => useAttachmentDeduplication())

    // Query should be disabled when there's no blob capability
    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false)
    })
  })

  it('should respect provided blobIds', async () => {
    const mockLookupResponse: BlobLookupResponse = {
      accountId: 'account-1',
      list: [
        {
          id: 'blob-provided',
          matchedIds: {
            Email: ['email-1', 'email-2', 'email-3'],
          },
        },
      ],
    }
    lookupBlobs.mockResolvedValueOnce(mockLookupResponse)

    const { result } = renderHook(() =>
      useAttachmentDeduplication({
        blobIds: ['blob-provided'],
        minReferenceCount: 2,
      })
    )

    await waitFor(() => {
      expect(lookupBlobs).toHaveBeenCalledWith(
        ['blob-provided'],
        ['Email'],
        'account-1'
      )
    })
  })
})

describe('useIsAttachmentDuplicated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPrimaryAccount.mockReturnValue('account-1')
    hasBlobCapability.mockReturnValue(true)
  })

  it('should return false for unique attachment', async () => {
    const mockLookupResponse: BlobLookupResponse = {
      accountId: 'account-1',
      list: [
        {
          id: 'blob-unique',
          matchedIds: {
            Email: ['email-1'],
          },
        },
      ],
    }
    lookupBlobs.mockResolvedValueOnce(mockLookupResponse)

    const { result } = renderHook(() => useIsAttachmentDuplicated('blob-unique'))

    await waitFor(() => {
      expect(result.current.data?.isDuplicated).toBe(false)
      expect(result.current.data?.referenceCount).toBe(1)
    })
  })

  it('should return true for duplicated attachment', async () => {
    const mockLookupResponse: BlobLookupResponse = {
      accountId: 'account-1',
      list: [
        {
          id: 'blob-dup',
          matchedIds: {
            Email: ['email-1', 'email-2', 'email-3'],
          },
        },
      ],
    }
    lookupBlobs.mockResolvedValueOnce(mockLookupResponse)

    const { result } = renderHook(() => useIsAttachmentDuplicated('blob-dup'))

    await waitFor(() => {
      expect(result.current.data?.isDuplicated).toBe(true)
      expect(result.current.data?.referenceCount).toBe(3)
    })
  })

  it('should disable query when blobId is undefined', async () => {
    const { result } = renderHook(() => useIsAttachmentDuplicated(undefined))

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false)
    })
    expect(lookupBlobs).not.toHaveBeenCalled()
  })
})

describe('useAttachmentReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPrimaryAccount.mockReturnValue('account-1')
    hasBlobCapability.mockReturnValue(true)
  })

  it('should fetch emails referencing a blob', async () => {
    const mockLookupResponse: BlobLookupResponse = {
      accountId: 'account-1',
      list: [
        {
          id: 'blob-refs',
          matchedIds: {
            Email: ['email-1', 'email-2'],
          },
        },
      ],
    }
    lookupBlobs.mockResolvedValueOnce(mockLookupResponse)

    const mockEmails: Email[] = [
      {
        id: 'email-1',
        blobId: 'email-blob-1',
        threadId: 'thread-1',
        mailboxIds: { inbox: true },
        keywords: {},
        size: 1000,
        receivedAt: '2026-04-02T10:00:00Z',
        hasAttachment: true,
        preview: 'First email',
        subject: 'Subject 1',
        from: [{ name: 'Sender', email: 'sender@example.com' }],
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        cc: null,
        bcc: null,
        replyTo: null,
      },
      {
        id: 'email-2',
        blobId: 'email-blob-2',
        threadId: 'thread-1',
        mailboxIds: { inbox: true },
        keywords: {},
        size: 1000,
        receivedAt: '2026-04-02T11:00:00Z',
        hasAttachment: true,
        preview: 'Second email',
        subject: 'Subject 2',
        from: [{ name: 'Sender', email: 'sender@example.com' }],
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        cc: null,
        bcc: null,
        replyTo: null,
      },
    ]

    request.mockResolvedValueOnce({
      methodResponses: [
        ['Email/get', { list: mockEmails }, '0'],
      ],
    })

    const { result } = renderHook(() => useAttachmentReferences('blob-refs'))

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2)
      expect(result.current.data?.[0].id).toBe('email-1')
      expect(result.current.data?.[1].id).toBe('email-2')
    })
  })

  it('should return empty array when blob has no references', async () => {
    const mockLookupResponse: BlobLookupResponse = {
      accountId: 'account-1',
      list: [
        {
          id: 'blob-no-refs',
          matchedIds: {},
        },
      ],
    }
    lookupBlobs.mockResolvedValueOnce(mockLookupResponse)

    const { result } = renderHook(() => useAttachmentReferences('blob-no-refs'))

    await waitFor(() => {
      expect(result.current.data).toEqual([])
    })
    expect(request).not.toHaveBeenCalled()
  })
})

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('should handle decimal places', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1536, 0)).toBe('2 KB')
  })
})

describe('getDeduplicationStatusText', () => {
  it('should return correct status text', () => {
    expect(getDeduplicationStatusText(0)).toBe('Not referenced')
    expect(getDeduplicationStatusText(1)).toBe('Unique')
    expect(getDeduplicationStatusText(2)).toBe('Duplicated (2x)')
    expect(getDeduplicationStatusText(3)).toBe('Duplicated (3x)')
    expect(getDeduplicationStatusText(5)).toBe('Heavily duplicated (5x)')
  })
})

describe('getDeduplicationStatusColor', () => {
  it('should return correct status colors', () => {
    expect(getDeduplicationStatusColor(0)).toBe('#34C759')
    expect(getDeduplicationStatusColor(1)).toBe('#34C759')
    expect(getDeduplicationStatusColor(2)).toBe('#FF9500')
    expect(getDeduplicationStatusColor(3)).toBe('#FF9500')
    expect(getDeduplicationStatusColor(4)).toBe('#FF3B30')
  })
})
