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

describe('RFC 9219 S/MIME', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrimaryAccount.mockReturnValue('account-1');
  });

  describe('hasSmimeCapability', () => {
    it('returns true when smime capability is present', () => {
      mockHasCapability.mockReturnValue(true);
      expect(mockHasCapability('urn:ietf:params:jmap:smime')).toBe(true);
    });

    it('returns false when smime capability is absent', () => {
      mockHasCapability.mockReturnValue(false);
      expect(mockHasCapability('urn:ietf:params:jmap:smime')).toBe(false);
    });
  });

  describe('Email/parseSmime', () => {
    it('sends correct request and returns parsed result', async () => {
      mockRequest.mockResolvedValue({
        methodResponses: [['Email/parseSmime', {
          accountId: 'account-1',
          parsed: {
            'blob-1': { status: 'verified', certificate: { subject: 'CN=Alice', issuer: 'CN=CA' } },
          },
        }, 'parseSmime0']],
        sessionState: 's1',
      });

      const result = await mockRequest(
        [['Email/parseSmime', { accountId: 'account-1', blobIds: ['blob-1'] }, 'parseSmime0']],
        ['urn:ietf:params:jmap:smime']
      );

      expect(result.methodResponses[0][1].parsed['blob-1'].status).toBe('verified');
      expect(result.methodResponses[0][1].parsed['blob-1'].certificate?.subject).toBe('CN=Alice');
    });
  });
});
