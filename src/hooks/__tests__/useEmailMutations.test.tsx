import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useEmailActions } from '../jmap/useEmailMutations'

const mockRequest = vi.fn()
const mockGetState = vi.fn()
const mockSetState = vi.fn()

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount: () => 'account-001',
    request: (...args: unknown[]) => mockRequest(...args),
    getAccountCapability: (urn: string) => {
      if (urn === 'urn:ietf:params:jmap:core') {
        return { maxObjectsInSet: 2 }
      }
      return {}
    },
  },
}))

vi.mock('../../utils/capabilityUtils', () => ({
  chunkForSet: (items: unknown[]) => {
    const chunks: unknown[][] = []
    for (let i = 0; i < items.length; i += 2) {
      chunks.push(items.slice(i, i + 2))
    }
    return chunks
  },
}))

vi.mock('../../api/stateManager', () => ({
  stateManager: {
    getState: (type: string) => mockGetState(type),
    setState: (type: string, state: string) => mockSetState(type, state),
    clearAll: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useEmailActions', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    mockGetState.mockReset()
    mockSetState.mockReset()
  })

  it('updateKeywords sends Email/set with ifInState from stateManager', async () => {
    mockGetState.mockReturnValue('email-state-123')
    mockRequest.mockResolvedValueOnce({
      methodResponses: [
        ['Email/set', { accountId: 'account-001', newState: 'email-state-456', updated: { e1: null } }, '0'],
      ],
    })

    const { result } = renderHook(() => useEmailActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.updateKeywords.mutateAsync({ emailId: 'e1', keywords: { $flagged: true } })
    })

    expect(mockGetState).toHaveBeenCalledWith('Email')
    const requestArgs = mockRequest.mock.calls[0][0][0][1]
    expect(requestArgs.ifInState).toBe('email-state-123')
    expect(mockSetState).toHaveBeenCalledWith('Email', 'email-state-456')
  })

  it('moveEmail sends Email/set with ifInState and updates state on success', async () => {
    mockGetState.mockReturnValue('email-state-old')
    mockRequest.mockResolvedValueOnce({
      methodResponses: [
        ['Email/set', { accountId: 'account-001', newState: 'email-state-new', updated: { e2: null } }, '0'],
      ],
    })

    const { result } = renderHook(() => useEmailActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.moveEmail.mutateAsync({ emailId: 'e2', mailboxIds: { 'mb-archive': true } })
    })

    const requestArgs = mockRequest.mock.calls[0][0][0][1]
    expect(requestArgs.ifInState).toBe('email-state-old')
    expect(mockSetState).toHaveBeenCalledWith('Email', 'email-state-new')
  })

  it('destroyEmail sends Email/set with ifInState and updates state on success', async () => {
    mockGetState.mockReturnValue('email-state-old')
    mockRequest.mockResolvedValueOnce({
      methodResponses: [
        ['Email/set', { accountId: 'account-001', newState: 'email-state-new', destroyed: ['e3'] }, '0'],
      ],
    })

    const { result } = renderHook(() => useEmailActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.destroyEmail.mutateAsync({ emailId: 'e3' })
    })

    const requestArgs = mockRequest.mock.calls[0][0][0][1]
    expect(requestArgs.ifInState).toBe('email-state-old')
    expect(mockSetState).toHaveBeenCalledWith('Email', 'email-state-new')
  })

  it('updateKeywords throws on stateMismatch and does not update state', async () => {
    mockGetState.mockReturnValue('email-state-old')
    mockRequest.mockResolvedValueOnce({
      methodResponses: [
        ['error', { type: 'stateMismatch', description: 'The email state has changed on the server' }, '0'],
      ],
    })

    const { result } = renderHook(() => useEmailActions(), { wrapper: createWrapper() })

    await expect(
      act(async () => {
        await result.current.updateKeywords.mutateAsync({ emailId: 'e1', keywords: { $flagged: true } })
      })
    ).rejects.toThrow('The email state has changed on the server')

    expect(mockSetState).not.toHaveBeenCalled()
  })

  it('moveEmail throws on stateMismatch and does not update state', async () => {
    mockGetState.mockReturnValue('email-state-old')
    mockRequest.mockResolvedValueOnce({
      methodResponses: [
        ['error', { type: 'stateMismatch', description: 'Server state changed' }, '0'],
      ],
    })

    const { result } = renderHook(() => useEmailActions(), { wrapper: createWrapper() })

    await expect(
      act(async () => {
        await result.current.moveEmail.mutateAsync({ emailId: 'e2', mailboxIds: { 'mb-archive': true } })
      })
    ).rejects.toThrow('Server state changed')

    expect(mockSetState).not.toHaveBeenCalled()
  })

  it('updateKeywordsBulk sends chunked requests with ifInState and updates state per chunk', async () => {
    mockGetState.mockReturnValue('email-state-bulk')
    mockRequest
      .mockResolvedValueOnce({
        methodResponses: [
          ['Email/set', { accountId: 'account-001', newState: 'email-state-chunk1', updated: { e1: null, e2: null } }, '0'],
        ],
      })
      .mockResolvedValueOnce({
        methodResponses: [
          ['Email/set', { accountId: 'account-001', newState: 'email-state-chunk2', updated: { e3: null } }, '0'],
        ],
      })

    const { result } = renderHook(() => useEmailActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.updateKeywordsBulk.mutateAsync({
        emailIds: ['e1', 'e2', 'e3'],
        keywords: { $seen: true },
      })
    })

    expect(mockRequest).toHaveBeenCalledTimes(2)
    expect(mockRequest.mock.calls[0][0][0][1].ifInState).toBe('email-state-bulk')
    expect(mockRequest.mock.calls[1][0][0][1].ifInState).toBe('email-state-bulk')
    expect(mockSetState).toHaveBeenCalledWith('Email', 'email-state-chunk1')
    expect(mockSetState).toHaveBeenCalledWith('Email', 'email-state-chunk2')
  })

  it('does not include ifInState when stateManager has no Email state', async () => {
    mockGetState.mockReturnValue(null)
    mockRequest.mockResolvedValueOnce({
      methodResponses: [
        ['Email/set', { accountId: 'account-001', newState: 'email-state-1', updated: { e1: null } }, '0'],
      ],
    })

    const { result } = renderHook(() => useEmailActions(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.updateKeywords.mutateAsync({ emailId: 'e1', keywords: { $flagged: true } })
    })

    const requestArgs = mockRequest.mock.calls[0][0][0][1]
    expect(requestArgs.ifInState).toBeUndefined()
    expect(mockSetState).toHaveBeenCalledWith('Email', 'email-state-1')
  })
})
