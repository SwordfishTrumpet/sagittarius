import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMailboxQuery, useThreadQuery, useIdentityQuery, useEmailCopy, useQuotaQuery } from '../jmap/useJMAPQueries'
import type { Mailbox, Thread, Identity, Email, Quota } from '../../types/jmap'

const { request, getPrimaryAccount } = vi.hoisted(() => ({
  request: vi.fn(),
  getPrimaryAccount: vi.fn().mockReturnValue('account-1'),
}))

const invalidateQueriesMock = vi.fn()
const cancelQueriesMock = vi.fn()
const getQueriesDataMock = vi.fn()
const setQueryDataMock = vi.fn()

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    request,
    getPrimaryAccount,
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
  useMutation: (options: { mutationFn: (vars: unknown) => Promise<unknown> }) => {
    const [isPending, setIsPending] = vi.mocked(require('react').useState)(false)
    
    const mutateAsync = async (variables: unknown) => {
      setIsPending(true)
      try {
        const result = await options.mutationFn(variables)
        setIsPending(false)
        return result
      } catch (err) {
        setIsPending(false)
        throw err
      }
    }
    
    return { mutateAsync, isPending }
  },
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
    cancelQueries: cancelQueriesMock,
    getQueriesData: getQueriesDataMock,
    setQueryData: setQueryDataMock,
  }),
}))

vi.mock('../../utils/offlineSyncQueue', () => ({
  isDeferredMutationResult: vi.fn().mockReturnValue(false),
  runDeferredAwareMutation: vi.fn(({ execute }) => execute()),
}))

vi.mock('../jmap/queryCacheUtils', () => ({
  invalidateMailboxQueries: vi.fn(),
  invalidateEmailQueries: vi.fn(),
  jmapMethodCall: vi.fn((method, args, id) => [method, args, id]),
  jmapRequest: vi.fn((requests) => request(...requests)),
  rollbackQueries: vi.fn(),
  suppressNewMailNotification: vi.fn(),
}))

describe('useMailboxQuery', () => {
  beforeEach(() => {
    request.mockReset()
    getPrimaryAccount.mockReturnValue('account-1')
  })

  it('returns undefined when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useMailboxQuery())
    await waitFor(() => expect(result.current.isEnabled).toBe(false))
  })

  it('fetches mailboxes matching filter', async () => {
    const mockMailbox: Mailbox = {
      id: 'mailbox-1',
      name: 'Inbox',
      parentId: null,
      role: 'inbox',
      sortOrder: 0,
      totalEmails: 10,
      unreadEmails: 2,
      totalThreads: 5,
      unreadThreads: 1,
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
      isSubscribed: true,
      childIds: [],
    }

    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Mailbox/query', { accountId: 'account-1', ids: ['mailbox-1'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Mailbox/get', { accountId: 'account-1', list: [mockMailbox], state: 'state-2' }, '1'],
        ],
      })

    const { result } = renderHook(() => useMailboxQuery({ filter: { name: 'inbox' } }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('mailbox-1')
  })

  it('returns empty array when query returns no IDs', async () => {
    request.mockResolvedValueOnce({
      methodResponses: [
        ['Mailbox/query', { accountId: 'account-1', ids: [], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
      ],
    })

    const { result } = renderHook(() => useMailboxQuery({ filter: { name: 'nonexistent' } }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })
})

describe('useThreadQuery', () => {
  beforeEach(() => {
    request.mockReset()
    getPrimaryAccount.mockReturnValue('account-1')
  })

  it('returns undefined when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useThreadQuery())
    await waitFor(() => expect(result.current.isEnabled).toBe(false))
  })

  it('fetches threads matching filter', async () => {
    const mockThread: Thread = {
      id: 'thread-1',
      emailIds: ['email-1', 'email-2'],
    }

    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Thread/query', { accountId: 'account-1', ids: ['thread-1'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Thread/get', { accountId: 'account-1', list: [mockThread], state: 'state-2' }, '1'],
        ],
      })

    const { result } = renderHook(() => useThreadQuery({ filter: { from: 'sender@example.com' } }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('thread-1')
    expect(result.current.data?.[0].emailIds).toEqual(['email-1', 'email-2'])
  })

  it('handles complex filter with allOf', async () => {
    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Thread/query', { accountId: 'account-1', ids: ['thread-1'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Thread/get', { accountId: 'account-1', list: [], state: 'state-2' }, '1'],
        ],
      })

    const complexFilter = {
      allOf: [
        { hasAttachment: true },
        { after: '2024-01-01T00:00:00Z' },
        { from: 'test@example.com' },
      ],
    }

    renderHook(() => useThreadQuery({ filter: complexFilter }))
  })
})

describe('useIdentityQuery', () => {
  beforeEach(() => {
    request.mockReset()
    getPrimaryAccount.mockReturnValue('account-1')
  })

  it('returns undefined when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useIdentityQuery())
    await waitFor(() => expect(result.current.isEnabled).toBe(false))
  })

  it('fetches identities matching filter', async () => {
    const mockIdentity: Identity = {
      id: 'identity-1',
      name: 'Test User',
      email: 'test@example.com',
      replyTo: null,
      bcc: null,
      textSignature: '',
      htmlSignature: '',
      mayDelete: true,
    }

    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Identity/query', { accountId: 'account-1', ids: ['identity-1'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Identity/get', { accountId: 'account-1', list: [mockIdentity], state: 'state-2' }, '1'],
        ],
      })

    const { result } = renderHook(() => useIdentityQuery({ filter: { email: '@example.com' } }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].email).toBe('test@example.com')
  })
})

describe('useQuotaQuery', () => {
  beforeEach(() => {
    request.mockReset()
    getPrimaryAccount.mockReturnValue('account-1')
  })

  it('returns undefined when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useQuotaQuery())
    await waitFor(() => expect(result.current.isEnabled).toBe(false))
  })

  it('fetches quotas matching filter by resource type', async () => {
    const mockQuota: Quota = {
      id: 'quota-1',
      resourceType: 'octets',
      used: 5000000,
      hardLimit: 10000000,
      scope: 'account',
      name: 'Storage Quota',
      types: ['Mail'],
    }

    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/query', { accountId: 'account-1', ids: ['quota-1'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/get', { accountId: 'account-1', list: [mockQuota], state: 'state-2' }, '1'],
        ],
      })

    const { result } = renderHook(() => useQuotaQuery({ filter: { resourceType: 'octets' } }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('quota-1')
    expect(result.current.data?.[0].resourceType).toBe('octets')
    expect(result.current.data?.[0].used).toBe(5000000)
  })

  it('fetches quotas matching filter by scope', async () => {
    const mockQuota: Quota = {
      id: 'quota-2',
      resourceType: 'messages',
      used: 100,
      hardLimit: 1000,
      scope: 'account',
      name: 'Message Count Quota',
    }

    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/query', { accountId: 'account-1', ids: ['quota-2'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/get', { accountId: 'account-1', list: [mockQuota], state: 'state-2' }, '1'],
        ],
      })

    const { result } = renderHook(() => useQuotaQuery({ filter: { scope: 'account' } }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].scope).toBe('account')
  })

  it('handles complex filter with allOf', async () => {
    const mockQuota: Quota = {
      id: 'quota-3',
      resourceType: 'octets',
      used: 1000000,
      hardLimit: 5000000,
      scope: 'account',
      name: 'Combined Filter Quota',
    }

    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/query', { accountId: 'account-1', ids: ['quota-3'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/get', { accountId: 'account-1', list: [mockQuota], state: 'state-2' }, '1'],
        ],
      })

    const complexFilter = {
      allOf: [
        { resourceType: 'octets' },
        { scope: 'account' },
      ],
    }

    const { result } = renderHook(() => useQuotaQuery({ filter: complexFilter }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].resourceType).toBe('octets')
    expect(result.current.data?.[0].scope).toBe('account')
  })

  it('returns empty array when query returns no IDs', async () => {
    request.mockResolvedValueOnce({
      methodResponses: [
        ['Quota/query', { accountId: 'account-1', ids: [], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
      ],
    })

    const { result } = renderHook(() => useQuotaQuery({ filter: { resourceType: 'nonexistent' } }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
  })

  it('fetches multiple quotas', async () => {
    const mockQuotas: Quota[] = [
      {
        id: 'quota-storage',
        resourceType: 'octets',
        used: 5000000,
        hardLimit: 10000000,
        scope: 'account',
        name: 'Storage',
      },
      {
        id: 'quota-messages',
        resourceType: 'messages',
        used: 500,
        hardLimit: 10000,
        scope: 'account',
        name: 'Messages',
      },
    ]

    request
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/query', { accountId: 'account-1', ids: ['quota-storage', 'quota-messages'], queryState: 'state-1', canCalculateChanges: false, position: 0 }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Quota/get', { accountId: 'account-1', list: mockQuotas, state: 'state-2' }, '1'],
        ],
      })

    const { result } = renderHook(() => useQuotaQuery())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].id).toBe('quota-storage')
    expect(result.current.data?.[1].id).toBe('quota-messages')
  })
})

describe('useEmailCopy', () => {
  beforeEach(() => {
    request.mockReset()
    invalidateQueriesMock.mockReset()
    getPrimaryAccount.mockReturnValue('account-1')
  })

  it('throws error when no account', async () => {
    getPrimaryAccount.mockReturnValue(null)
    const { result } = renderHook(() => useEmailCopy())

    await expect(
      result.current.mutateAsync({
        emailId: 'email-1',
        targetMailboxIds: { 'mailbox-2': true },
      })
    ).rejects.toThrow('No account available for Email/copy')
  })

  it('copies email to target mailbox', async () => {
    request.mockResolvedValueOnce({
      methodResponses: [
        [
          'Email/copy',
          {
            accountId: 'account-1',
            fromAccountId: 'account-1',
            created: {
              'copy-123': {
                id: 'email-copy-1',
                blobId: 'blob-1',
                threadId: 'thread-1',
                size: 1024,
              },
            },
          },
          '0',
        ],
      ],
    })

    const { result } = renderHook(() => useEmailCopy())

    const copyResult = await result.current.mutateAsync({
      emailId: 'email-1',
      targetMailboxIds: { 'mailbox-2': true },
    })

    expect(copyResult).toBeDefined()
    expect(request).toHaveBeenCalledTimes(1)
    const copyCall = request.mock.calls[0][0]
    expect(copyCall[0]).toBe('Email/copy')
    expect(copyCall[1].accountId).toBe('account-1')
  })

  it('copies email with keywords when copyKeywords is true', async () => {
    const mockEmail: Email = {
      id: 'email-1',
      blobId: 'blob-1',
      threadId: 'thread-1',
      mailboxIds: { 'mailbox-1': true },
      keywords: { $seen: true, $flagged: true },
      size: 1024,
      receivedAt: '2024-01-01T00:00:00Z',
      hasAttachment: false,
      preview: 'Test preview',
      subject: 'Test',
      from: null,
      to: null,
      cc: null,
      bcc: null,
      replyTo: null,
    }

    request
      .mockResolvedValueOnce({
        methodResponses: [['Email/get', { accountId: 'account-1', list: [mockEmail], state: 'state-1' }, 'get0']],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          [
            'Email/copy',
            {
              accountId: 'account-1',
              fromAccountId: 'account-1',
              created: {
                'copy-123': {
                  id: 'email-copy-1',
                  blobId: 'blob-1',
                  threadId: 'thread-1',
                  size: 1024,
                },
              },
            },
            '0',
          ],
        ],
      })

    const { result } = renderHook(() => useEmailCopy())

    await result.current.mutateAsync({
      emailId: 'email-1',
      targetMailboxIds: { 'mailbox-2': true },
      copyKeywords: true,
    })

    // First call should be Email/get to fetch keywords
    expect(request).toHaveBeenCalledTimes(2)
    const getCall = request.mock.calls[0][0][0]
    expect(getCall[0]).toBe('Email/get')
    expect(getCall[1].properties).toContain('keywords')
  })

  it('supports cross-account copy with fromAccountId', async () => {
    request.mockResolvedValueOnce({
      methodResponses: [
        [
          'Email/copy',
          {
            accountId: 'account-2',
            fromAccountId: 'account-1',
            created: {
              'copy-123': {
                id: 'email-copy-1',
                blobId: 'blob-1',
                threadId: 'thread-1',
                size: 1024,
              },
            },
          },
          '0',
        ],
      ],
    })

    const { result } = renderHook(() => useEmailCopy())

    await result.current.mutateAsync({
      emailId: 'email-1',
      targetMailboxIds: { 'mailbox-2': true },
      fromAccountId: 'account-1',
    })

    const copyCall = request.mock.calls[0][0]
    expect(copyCall[0]).toBe('Email/copy')
    expect(copyCall[1].fromAccountId).toBe('account-1')
  })
})