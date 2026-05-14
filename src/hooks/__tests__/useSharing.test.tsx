import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { JMAPResponse } from '../../api/jmap';

const mockRequest = vi.fn();
const mockHasCapability = vi.fn();
const mockGetPrimaryAccount = vi.fn();
const mockQueryPrincipals = vi.fn();

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    request: mockRequest,
    hasCapability: mockHasCapability,
    getPrimaryAccount: mockGetPrimaryAccount,
    queryPrincipals: mockQueryPrincipals,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrimaryAccount.mockReturnValue('account-1');
  });

  describe('useHasSharingCapability', () => {
    it('returns true when sharing capability is present', async () => {
      mockHasCapability.mockReturnValue(true);
      const { useHasSharingCapability } = await import('../useSharing');
      const { result } = renderHook(() => useHasSharingCapability(), { wrapper: createWrapper() });
      expect(result.current).toBe(true);
    });

    it('returns false when sharing capability is absent', async () => {
      mockHasCapability.mockReturnValue(false);
      const { useHasSharingCapability } = await import('../useSharing');
      const { result } = renderHook(() => useHasSharingCapability(), { wrapper: createWrapper() });
      expect(result.current).toBe(false);
    });
  });

  describe('usePrincipalQuery', () => {
    it('calls queryPrincipals with filter', async () => {
      mockQueryPrincipals.mockResolvedValue({ ids: ['p1', 'p2'] });
      const { usePrincipalQuery } = await import('../useSharing');
      const { result } = renderHook(() => usePrincipalQuery(), { wrapper: createWrapper() });

      result.current.mutate({ text: 'alice' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockQueryPrincipals).toHaveBeenCalledWith({ text: 'alice' }, 'account-1');
    });
  });
});
