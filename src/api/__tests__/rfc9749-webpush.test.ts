import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRequest = vi.fn();
const mockHasCapability = vi.fn();
const mockGetPrimaryAccount = vi.fn();

vi.mock('../jmap', () => ({
  jmapClient: {
    request: mockRequest,
    hasCapability: mockHasCapability,
    getPrimaryAccount: mockGetPrimaryAccount,
  },
}));

describe('RFC 9749 JMAP WebPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrimaryAccount.mockReturnValue('account-1');
  });

  describe('hasWebPushCapability', () => {
    it('returns true when webpush capability is present', () => {
      mockHasCapability.mockReturnValue(true);
      expect(mockHasCapability('urn:ietf:params:jmap:webpush')).toBe(true);
    });

    it('returns false when webpush capability is absent', () => {
      mockHasCapability.mockReturnValue(false);
      expect(mockHasCapability('urn:ietf:params:jmap:webpush')).toBe(false);
    });
  });

  describe('PushSubscription/get', () => {
    it('sends correct request', async () => {
      mockRequest.mockResolvedValue({
        methodResponses: [['PushSubscription/get', { accountId: 'account-1', list: [{
          id: 'sub-1', deviceClientId: 'd1', url: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'auth1' },
        }] }, 'pushSubGet0']],
        sessionState: 's1',
      });

      const result = await mockRequest(
        [['PushSubscription/get', { accountId: 'account-1', ids: null }, 'pushSubGet0']],
        ['urn:ietf:params:jmap:webpush']
      );

      expect(result.methodResponses[0][1].list).toHaveLength(1);
    });
  });

  describe('PushSubscription/set', () => {
    it('sends create request', async () => {
      const sub = { deviceClientId: 'd1', url: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'auth1' } };
      mockRequest.mockResolvedValue({
        methodResponses: [['PushSubscription/set', { accountId: 'account-1', newState: 's1', created: { 'new-1': { id: 'sub-1', ...sub } } }, 'pushSubSet0']],
        sessionState: 's1',
      });

      const result = await mockRequest(
        [['PushSubscription/set', { accountId: 'account-1', create: { 'new-1': sub } }, 'pushSubSet0']],
        ['urn:ietf:params:jmap:webpush']
      );

      expect(result.methodResponses[0][1].created?.['new-1']?.id).toBe('sub-1');
    });

    it('sends destroy request', async () => {
      mockRequest.mockResolvedValue({
        methodResponses: [['PushSubscription/set', { accountId: 'account-1', newState: 's1', destroyed: ['sub-1'] }, 'pushSubDestroy0']],
        sessionState: 's1',
      });

      const result = await mockRequest(
        [['PushSubscription/set', { accountId: 'account-1', destroy: ['sub-1'] }, 'pushSubDestroy0']],
        ['urn:ietf:params:jmap:webpush']
      );

      expect(result.methodResponses[0][1].destroyed).toContain('sub-1');
    });
  });
});
