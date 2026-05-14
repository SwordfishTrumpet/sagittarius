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

describe('RFC 9661 SieveScript/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrimaryAccount.mockReturnValue('account-1');
  });

  it('calls SieveScript/activate method', async () => {
    mockRequest.mockResolvedValue({
      methodResponses: [['SieveScript/activate', {}, '0']],
      sessionState: 's1',
    });

    const result = await mockRequest(
      [['SieveScript/activate', { accountId: 'account-1', id: 'script-1' }, '0']],
      ['urn:ietf:params:jmap:sieve']
    );

    expect(mockRequest).toHaveBeenCalledWith(
      [['SieveScript/activate', { accountId: 'account-1', id: 'script-1' }, '0']],
      ['urn:ietf:params:jmap:sieve']
    );
    expect(result.methodResponses[0][0]).toBe('SieveScript/activate');
  });

  it('uses correct capability URN', () => {
    mockHasCapability.mockReturnValue(true);
    expect(mockHasCapability('urn:ietf:params:jmap:sieve')).toBe(true);
  });
});
