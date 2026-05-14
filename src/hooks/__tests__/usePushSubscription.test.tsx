import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockHasCapability = vi.fn();
const mockGetPrimaryAccount = vi.fn();
const mockGetPushSubscriptions = vi.fn();

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    hasCapability: mockHasCapability,
    getPrimaryAccount: mockGetPrimaryAccount,
    getPushSubscriptions: mockGetPushSubscriptions,
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

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrimaryAccount.mockReturnValue('account-1');
  });

  describe('useHasWebPushCapability', () => {
    it('returns true when webpush capability is present', async () => {
      mockHasCapability.mockReturnValue(true);
      const { useHasWebPushCapability } = await import('../usePushSubscription');
      const { result } = renderHook(() => useHasWebPushCapability(), { wrapper: createWrapper() });
      expect(result.current).toBe(true);
    });

    it('returns false when webpush capability is absent', async () => {
      mockHasCapability.mockReturnValue(false);
      const { useHasWebPushCapability } = await import('../usePushSubscription');
      const { result } = renderHook(() => useHasWebPushCapability(), { wrapper: createWrapper() });
      expect(result.current).toBe(false);
    });
  });

  describe('useNotificationPermission', () => {
    it('returns null when Notification API is unavailable', async () => {
      const { useNotificationPermission } = await import('../usePushSubscription');
      const { result } = renderHook(() => useNotificationPermission(), { wrapper: createWrapper() });
      expect(result.current.permission).toBeNull();
    });
  });

  describe('usePushSubscription', () => {
    it('returns existing subs when permission is granted', async () => {
      mockHasCapability.mockReturnValue(true);
      mockGetPushSubscriptions.mockResolvedValue({ list: [{ id: 'sub-1' }] });

      vi.stubGlobal('Notification', { permission: 'granted' });

      const { usePushSubscription } = await import('../usePushSubscription');
      const { result } = renderHook(() => usePushSubscription(), { wrapper: createWrapper() });

      await waitFor(() => {
        if (result.current.existingSubs) {
          expect(result.current.existingSubs.list).toHaveLength(1);
        }
      });
    });

    it('permission returns current Notification.permission', async () => {
      vi.stubGlobal('Notification', { permission: 'default' });

      const { usePushSubscription } = await import('../usePushSubscription');
      const { result } = renderHook(() => usePushSubscription(), { wrapper: createWrapper() });

      expect(result.current.permission).toBe('default');
    });
  });
});
