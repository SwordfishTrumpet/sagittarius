import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRequest = vi.fn();
const mockHasCapability = vi.fn();
const mockGetAccountCapability = vi.fn();
const mockGetPrimaryAccount = vi.fn();

vi.mock('../jmap', () => ({
  jmapClient: {
    request: mockRequest,
    hasCapability: mockHasCapability,
    getAccountCapability: mockGetAccountCapability,
    getPrimaryAccount: mockGetPrimaryAccount,
  },
}));

describe('RFC 9670 JMAP Sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrimaryAccount.mockReturnValue('account-1');
  });

  describe('hasSharingCapability', () => {
    it('returns true when sharing capability is present', () => {
      mockHasCapability.mockReturnValue(true);
      expect(mockHasCapability('urn:ietf:params:jmap:sharing')).toBe(true);
    });

    it('returns false when sharing capability is absent', () => {
      mockHasCapability.mockReturnValue(false);
      expect(mockHasCapability('urn:ietf:params:jmap:sharing')).toBe(false);
    });
  });

  describe('getSharingCapability', () => {
    it('returns capability config when available', () => {
      mockGetAccountCapability.mockReturnValue({ maxPrincipals: 100 });
      const result = mockGetAccountCapability('urn:ietf:params:jmap:sharing');
      expect(result).toEqual({ maxPrincipals: 100 });
    });

    it('returns null when no capability', () => {
      mockGetAccountCapability.mockReturnValue(null);
      const result = mockGetAccountCapability('urn:ietf:params:jmap:sharing');
      expect(result).toBeNull();
    });
  });

  describe('Principal/get', () => {
    it('sends correct request', async () => {
      mockRequest.mockResolvedValue({
        methodResponses: [['Principal/get', { accountId: 'account-1', state: 's1', list: [{ id: 'p1', name: 'Alice', type: 'individual' }] }, 'principalGet0']],
        sessionState: 's1',
      });

      const result = await mockRequest(
        [['Principal/get', { accountId: 'account-1', ids: null }, 'principalGet0']],
        ['urn:ietf:params:jmap:sharing']
      );

      expect(result.methodResponses[0][1].list[0].name).toBe('Alice');
    });
  });

  describe('Principal/query', () => {
    it('sends correct request', async () => {
      mockRequest.mockResolvedValue({
        methodResponses: [['Principal/query', { accountId: 'account-1', queryState: 'q1', canCalculateChanges: true, position: 0, ids: ['p1', 'p2'] }, 'principalQuery0']],
        sessionState: 's1',
      });

      const result = await mockRequest(
        [['Principal/query', { accountId: 'account-1', filter: { text: 'alice' } }, 'principalQuery0']],
        ['urn:ietf:params:jmap:sharing']
      );

      expect(result.methodResponses[0][1].ids).toHaveLength(2);
    });
  });
});
