/**
 * RFC 8620 (JMAP Core) Compliance Tests
 *
 * Tests the JMAP client's adherence to RFC 8620:
 * - Section 2: The JMAP Session Resource
 * - Section 3: Structured Data Exchange (Request/Response)
 * - Section 5: Standard Methods (/get, /set, /changes, /query)
 * - Section 6: Binary Data (upload/download URLs)
 * - Section 7: Push Notifications (EventSource)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EmailFilter, EmailFilterCondition, EmailFilterOperator } from '../../types/jmap';

// ---------------------------------------------------------------------------
// We test the JMAPClient class by importing a fresh module per test group.
// The singleton is module-scoped, so we use dynamic imports and vi.resetModules().
// For unit tests of the request/session logic, we mock fetch.
// ---------------------------------------------------------------------------

// Mock sessionStorage before importing the module
const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
  get length() { return Object.keys(mockSessionStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
};

// A well-formed JMAP Session object per RFC 8620 §2
function makeSession(overrides: Record<string, any> = {}) {
  return {
    username: 'user@example.com',
    apiUrl: 'https://mail.example.com/jmap/',
    downloadUrl: 'https://mail.example.com/jmap/download/{accountId}/{blobId}/{name}?accept={type}',
    uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
    eventSourceUrl: 'https://mail.example.com/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
    capabilities: {
      'urn:ietf:params:jmap:core': {
        maxSizeUpload: 50000000,
        maxConcurrentUpload: 4,
        maxSizeRequest: 10000000,
        maxConcurrentRequests: 8,
        maxCallsInRequest: 16,
        maxObjectsInGet: 500,
        maxObjectsInSet: 500,
        collationAlgorithms: ['i;ascii-casemap'],
      },
      'urn:ietf:params:jmap:mail': {},
      'urn:ietf:params:jmap:submission': {},
    },
    accounts: {
      'account-001': {
        name: 'user@example.com',
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: {
          'urn:ietf:params:jmap:mail': {},
          'urn:ietf:params:jmap:submission': {},
        },
      },
    },
    primaryAccounts: {
      'urn:ietf:params:jmap:mail': 'account-001',
      'urn:ietf:params:jmap:submission': 'account-001',
    },
    state: 'session-state-001',
    ...overrides,
  };
}

describe('RFC 8620 — JMAP Core Protocol', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset module state
    vi.resetModules();
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
    // Stub window.location.replace to prevent jsdom errors
    vi.stubGlobal('location', { replace: vi.fn(), href: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // Section 2: The JMAP Session Resource
  // =========================================================================
  describe('§2 — Session Resource', () => {
    it('should authenticate with Basic auth and receive a valid session', async () => {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      const result = await jmapClient.authenticate('user@example.com', 'password');

      // RFC 8620 §2: The session object MUST include these fields
      expect(result).toHaveProperty('apiUrl');
      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('eventSourceUrl');
      expect(result).toHaveProperty('capabilities');
      expect(result).toHaveProperty('accounts');
      expect(result).toHaveProperty('primaryAccounts');
      expect(result).toHaveProperty('state');
    });

    it('should send Accept: application/json header on session request', async () => {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      const call = fetchMock.mock.calls[0];
      expect(call[1].headers['Accept']).toBe('application/json');
    });

    it('should use Basic authentication scheme (RFC 7617)', async () => {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      const call = fetchMock.mock.calls[0];
      const authHeader = call[1].headers['Authorization'];
      expect(authHeader).toMatch(/^Basic /);

      // Verify the base64 payload decodes to user:password
      const decoded = atob(authHeader.replace('Basic ', ''));
      expect(decoded).toBe('user@example.com:password');
    });

    it('should persist session to sessionStorage', async () => {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'jmap_session',
        expect.any(String),
      );
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'jmap_auth',
        expect.stringMatching(/^Basic /),
      );
    });

    it('should rewrite absolute session URLs to relative paths for proxy', async () => {
      const session = makeSession({
        apiUrl: 'https://mail.example.com:8080/jmap/',
        downloadUrl: 'https://mail.example.com:8080/jmap/download/%7BaccountId%7D/%7BblobId%7D/%7Bname%7D?accept=%7Btype%7D',
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');
      const stored = jmapClient.getStoredSession()!;

      // Must be relative (no scheme://host)
      expect(stored.apiUrl).toBe('/jmap/');
      // Must decode URL-encoded braces back to {/} for JMAP template placeholders
      expect(stored.downloadUrl).toContain('{accountId}');
      expect(stored.downloadUrl).toContain('{blobId}');
      expect(stored.downloadUrl).not.toContain('%7B');
      expect(stored.downloadUrl).not.toContain('%7D');
    });

    it('should try stripped username fallback on 401', async () => {
      const session = makeSession();
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
        .mockResolvedValueOnce({ ok: true, json: async () => session, text: async () => JSON.stringify(session) });

      const { jmapClient } = await import('../jmap');
      const result = await jmapClient.authenticate('user@example.com', 'password');

      // Two fetch calls: first with user@example.com, second with "user"
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondCallAuth = fetchMock.mock.calls[1][1].headers['Authorization'];
      const decoded = atob(secondCallAuth.replace('Basic ', ''));
      expect(decoded).toBe('user:password');
      expect(result.apiUrl).toBeDefined();
    });

    it('should try configured email and internal username aliases for bare usernames', async () => {
      vi.stubEnv('VITE_LOGIN_EMAIL_DOMAIN', 'wellintime.com');

      const session = makeSession({ username: 'remcov@wellintime.com' });
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
        .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
        .mockResolvedValueOnce({ ok: true, json: async () => session, text: async () => JSON.stringify(session) });

      const { jmapClient } = await import('../jmap');
      const result = await jmapClient.authenticate(' remcov ', 'password');

      expect(fetchMock).toHaveBeenCalledTimes(3);

      const authHeaders = fetchMock.mock.calls.map(([, init]) => init.headers['Authorization']);
      const decodedHeaders = authHeaders.map((header) => atob(header.replace('Basic ', '')));

      expect(decodedHeaders).toEqual([
        'remcov:password',
        'remcov@wellintime.com:password',
        'remcov-wellintime:password',
      ]);
      expect(result.username).toBe('remcov@wellintime.com');
    });

    it('should identify primary account for a capability', async () => {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      // RFC 8620 §2: primaryAccounts maps capability URN -> accountId
      expect(jmapClient.getPrimaryAccount('urn:ietf:params:jmap:mail')).toBe('account-001');
      expect(jmapClient.getPrimaryAccount('urn:ietf:params:jmap:submission')).toBe('account-001');
    });

    it('should detect capabilities from session', async () => {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      expect(jmapClient.hasCapability('urn:ietf:params:jmap:core')).toBe(true);
      expect(jmapClient.hasCapability('urn:ietf:params:jmap:mail')).toBe(true);
      expect(jmapClient.hasCapability('urn:ietf:params:jmap:nonexistent')).toBe(false);
    });
  });

  // =========================================================================
  // Section 3: Structured Data Exchange
  // =========================================================================
  describe('§3 — Request/Response Format', () => {
    async function authenticatedClient() {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });
      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');
      return jmapClient;
    }

    it('should send Content-Type: application/json on API requests (§3.2)', async () => {
      const client = await authenticatedClient();

      const mockResponse = { methodResponses: [['Mailbox/get', { list: [] }, '0']], sessionState: 's1' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await client.request([['Mailbox/get', { accountId: 'account-001', ids: null }, '0']]);

      // The API request (second fetch call, after auth) must have correct Content-Type
      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[1].headers['Content-Type']).toBe('application/json');
    });

    it('should use POST method for API requests (§3.2)', async () => {
      const client = await authenticatedClient();

      const mockResponse = { methodResponses: [['Mailbox/get', { list: [] }, '0']], sessionState: 's1' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await client.request([['Mailbox/get', { accountId: 'account-001', ids: null }, '0']]);

      const apiCall = fetchMock.mock.calls[1];
      expect(apiCall[1].method).toBe('POST');
    });

    it('should include "using" array with capability URNs (§3.3)', async () => {
      const client = await authenticatedClient();

      const mockResponse = { methodResponses: [['Mailbox/get', { list: [] }, '0']], sessionState: 's1' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await client.request([['Mailbox/get', { accountId: 'account-001', ids: null }, '0']]);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);

      // RFC 8620 §3.3: Request object MUST contain "using" and "methodCalls"
      expect(body).toHaveProperty('using');
      expect(body).toHaveProperty('methodCalls');

      // "using" must be an array of capability URN strings
      expect(Array.isArray(body.using)).toBe(true);
      expect(body.using).toContain('urn:ietf:params:jmap:core');
    });

    it('should include default capabilities: core, mail, submission (§3.3)', async () => {
      const client = await authenticatedClient();

      const mockResponse = { methodResponses: [['Mailbox/get', { list: [] }, '0']], sessionState: 's1' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await client.request([['Mailbox/get', { accountId: 'account-001', ids: null }, '0']]);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.using).toContain('urn:ietf:params:jmap:core');
      expect(body.using).toContain('urn:ietf:params:jmap:mail');
      expect(body.using).toContain('urn:ietf:params:jmap:submission');
    });

    it('should merge extra capabilities without duplicates (§3.3)', async () => {
      const client = await authenticatedClient();

      const mockResponse = { methodResponses: [['MDN/send', {}, '0']], sessionState: 's1' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await client.request(
        [['MDN/send', { accountId: 'account-001', send: {} }, '0']],
        ['urn:ietf:params:jmap:mdn', 'urn:ietf:params:jmap:core'], // core is a duplicate
      );

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      // No duplicates in using array
      const uniqueUsing = [...new Set(body.using)];
      expect(body.using.length).toBe(uniqueUsing.length);
      // Extra capability is present
      expect(body.using).toContain('urn:ietf:params:jmap:mdn');
    });

    it('should format methodCalls as [methodName, args, callId] tuples (§3.2)', async () => {
      const client = await authenticatedClient();

      const mockResponse = { methodResponses: [['Email/get', { list: [] }, '0']], sessionState: 's1' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const methodCalls: [string, Record<string, unknown>, string][] = [
        ['Email/query', { accountId: 'account-001', filter: {} }, '0'],
        ['Email/get', { accountId: 'account-001', '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' } }, '1'],
      ];
      await client.request(methodCalls);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);

      // Each method call must be a 3-element array: [name, args, callId]
      body.methodCalls.forEach((mc: any[]) => {
        expect(mc).toHaveLength(3);
        expect(typeof mc[0]).toBe('string');        // method name
        expect(typeof mc[1]).toBe('object');         // arguments
        expect(typeof mc[2]).toBe('string');         // call ID
      });
    });

    it('should handle 401 by logging out (§3.6.1)', async () => {
      const client = await authenticatedClient();

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        client.request([['Mailbox/get', { accountId: 'account-001', ids: null }, '0']]),
      ).rejects.toThrow('Session expired');
    });
  });

  // =========================================================================
  // Section 6: Binary Data (Upload / Download)
  // =========================================================================
  describe('§6 — Binary Data', () => {
    it('should resolve download URL template with correct placeholders (§6.2)', async () => {
      const session = makeSession();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => session,
        text: async () => JSON.stringify(session),
      });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      const url = jmapClient.getBlobUrl('blob-123', 'application/pdf', 'report.pdf');

      // RFC 8620 §6.2: URL template uses {accountId}, {blobId}, {name}, {type}
      expect(url).toContain('account-001');
      expect(url).toContain('blob-123');
      expect(url).toContain(encodeURIComponent('report.pdf'));
      expect(url).toContain(encodeURIComponent('application/pdf'));
      // Must not contain unresolved template variables
      expect(url).not.toContain('{accountId}');
      expect(url).not.toContain('{blobId}');
      expect(url).not.toContain('{name}');
      expect(url).not.toContain('{type}');
    });

    it('should upload blob with correct Content-Type (§6.1)', async () => {
      const session = makeSession();
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => session, text: async () => JSON.stringify(session) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ accountId: 'account-001', blobId: 'blob-new', type: 'image/png', size: 1024 }) });

      const { jmapClient } = await import('../jmap');
      await jmapClient.authenticate('user@example.com', 'password');

      const file = new File(['test'], 'image.png', { type: 'image/png' });
      await jmapClient.uploadBlob(file);

      const uploadCall = fetchMock.mock.calls[1];
      expect(uploadCall[1].method).toBe('POST');
      expect(uploadCall[1].headers['Content-Type']).toBe('image/png');
      expect(uploadCall[1].headers['Authorization']).toMatch(/^Basic /);
    });
  });

  // =========================================================================
  // Section 5.5: Filter Operators
  // =========================================================================
  describe('§5.5 — Filter Operators', () => {
    it('should use allOf for AND filter combination (§5.5)', async () => {
      const { mergeFiltersAND } = await import('../../utils/filterBuilder');

      const result = mergeFiltersAND({ from: 'alice' }, { to: 'bob' });
      expect(result).toEqual({ allOf: [{ from: 'alice' }, { to: 'bob' }] });
    });

    it('should use anyOf for OR filter combination (§5.5)', async () => {
      const { mergeFiltersOR } = await import('../../utils/filterBuilder');

      const result = mergeFiltersOR({ from: 'alice' }, { from: 'bob' });
      expect(result).toEqual({ anyOf: [{ from: 'alice' }, { from: 'bob' }] });
    });

    it('should handle single-filter AND/OR by returning the filter directly', async () => {
      const { mergeFiltersAND, mergeFiltersOR } = await import('../../utils/filterBuilder');

      const single = { from: 'alice' };
      expect(mergeFiltersAND(single)).toEqual(single);
      expect(mergeFiltersOR(single)).toEqual(single);
    });

    it('should handle empty-filter AND/OR by returning empty object', async () => {
      const { mergeFiltersAND, mergeFiltersOR } = await import('../../utils/filterBuilder');

      expect(mergeFiltersAND()).toEqual({});
      expect(mergeFiltersOR()).toEqual({});
    });

    it('should negate filter with NOT operator (§5.5)', async () => {
      const { negateFilter } = await import('../../utils/filterBuilder');

      const result = negateFilter({ from: 'alice' });
      // RFC 8620 §5.5 FilterOperator: operator: "NOT", conditions: [...]
      expect(result).toHaveProperty('operator', 'NOT');
      expect(result).toHaveProperty('conditions');
      expect(Array.isArray((result as { conditions: unknown[] }).conditions)).toBe(true);
      expect((result as { conditions: unknown[] }).conditions).toHaveLength(1);
    });

    it('should skip empty filters when merging', async () => {
      const { mergeFiltersAND } = await import('../../utils/filterBuilder');

      const result = mergeFiltersAND({}, { from: 'alice' }, {});
      expect(result).toEqual({ from: 'alice' });
    });
  });
});
