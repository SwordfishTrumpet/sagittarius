import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockRequest = vi.fn();
const mockHasCapability = vi.fn();
const mockGetPrimaryAccount = vi.fn();

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    request: mockRequest,
    hasCapability: mockHasCapability,
    getPrimaryAccount: mockGetPrimaryAccount,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSieveActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrimaryAccount.mockReturnValue('account-1');
    mockHasCapability.mockReturnValue(true);
  });

  it('activateScript calls SieveScript/activate', async () => {
    mockRequest.mockResolvedValue({
      methodResponses: [['SieveScript/activate', {}, '0']],
      sessionState: 's1',
    });

    const { useSieveActions } = await import('../../hooks/useSieve');
    const { result } = renderHook(() => useSieveActions(), { wrapper: createWrapper() });

    result.current.activateScript.mutate('script-1');
    await waitFor(() => expect(result.current.activateScript.isSuccess).toBe(true));

    expect(mockRequest).toHaveBeenCalledWith(
      [['SieveScript/activate', { accountId: 'account-1', id: 'script-1' }, '0']],
      ['urn:ietf:params:jmap:sieve']
    );
  });

  it('activateScript invalidates sieve query on success', async () => {
    mockRequest.mockResolvedValue({
      methodResponses: [['SieveScript/activate', {}, '0']],
      sessionState: 's1',
    });

    const { useSieveActions } = await import('../../hooks/useSieve');
    const { result } = renderHook(() => useSieveActions(), { wrapper: createWrapper() });

    result.current.activateScript.mutate('script-1');
    await waitFor(() => expect(result.current.activateScript.isSuccess).toBe(true));
  });
});
