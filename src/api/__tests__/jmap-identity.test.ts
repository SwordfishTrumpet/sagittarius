/**
 * Tests for the server-identity gate and error classification in
 * src/api/jmap.ts (issue #1).
 *
 * Coverage:
 *  - authenticate() blocks credential transmission when the stored backend
 *    fingerprint differs, until the user explicitly confirms.
 *  - authenticate() classifies 401/403 (auth), 502/503/504 + network
 *    failures (server-unreachable).
 *  - request() never sends credentials before the identity check completes
 *    and refuses them after an identity change.
 *  - request() classifies failures with the shared taxonomy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthError, ServerUnreachableError, JMAPProtocolError } from '../../utils/jmapErrors';
import {
  ServerIdentityChangedError,
  getStoredFingerprint,
  storeFingerprint,
  type ServerFingerprint,
} from '../../utils/serverFingerprint';

vi.mock('../eventSource', () => ({
  eventSourceManager: { disconnect: vi.fn() },
}));

vi.mock('../websocket', () => ({
  webSocketManager: { disconnect: vi.fn() },
}));

vi.mock('../stateManager', () => ({
  stateManager: { clearAll: vi.fn(), getState: vi.fn(), setState: vi.fn() },
}));

vi.mock('../../utils/csrf', () => ({
  getCsrfToken: vi.fn(() => 'csrf-token'),
  getCsrfHeaderName: vi.fn(() => 'x-csrf-token'),
  clearCsrfToken: vi.fn(),
  regenerateCsrfToken: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  redactUrl: (url: string) => url,
}));

import { jmapClient } from '../jmap';

const SESSION = {
  apiUrl: '/jmap/',
  downloadUrl: '/jmap/download/{accountId}/{blobId}/{name}',
  uploadUrl: '/jmap/upload/{accountId}/',
  capabilities: {},
  primaryAccounts: {},
  accounts: {},
};

const FINGERPRINT_A: ServerFingerprint = {
  host: 'mail.example.com',
  scheme: 'https',
  resolved: true,
  addresses: ['1.2.3.4'],
  certFingerprint: 'sha256:aaa',
  trusted: false,
  error: null,
};

const FINGERPRINT_B: ServerFingerprint = {
  host: 'mail.example.com',
  scheme: 'https',
  resolved: true,
  addresses: ['9.9.9.9'],
  certFingerprint: 'sha256:bbb',
  trusted: false,
  error: null,
};

const UNRESOLVED_FINGERPRINT: ServerFingerprint = {
  host: 'lapsed.example.com',
  scheme: 'https',
  resolved: false,
  addresses: [],
  certFingerprint: null,
  trusted: false,
  error: 'DNS resolution failed',
};

type Router = (url: string, init?: RequestInit) => Response | Promise<Response>;

function installFetch(router: Router) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => router(String(input), init)));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Fresh Response per call: authenticate() tries multiple username variants,
// and a shared Response body can only be read once.
const sessionResponse = () => jsonResponse(SESSION);

const jmapOkResponse = () => jsonResponse({
  methodResponses: [['Email/get', { state: 's1', list: [] }, '0']],
  sessionState: 's1',
});

type PrivateClient = {
  session: unknown;
  authHeader: string | null;
  _identityVerified: boolean;
};

function seedSession() {
  sessionStorage.setItem('jmap_auth', 'Basic dGVzdDp0ZXN0');
  sessionStorage.setItem('jmap_session', JSON.stringify(SESSION));
  const client = jmapClient as unknown as PrivateClient;
  client.session = SESSION;
  client.authHeader = 'Basic dGVzdDp0ZXN0';
  client._identityVerified = false;
}

function assertNoCredentialsSent(fetchMock: ReturnType<typeof vi.fn>) {
  const jmapCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/jmap/session') || String(url).includes('/jmap/'));
  expect(jmapCalls).toHaveLength(0);
}

describe('jmapClient server-identity gate (issue #1)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  describe('authenticate()', () => {
    it('succeeds on first login (no stored fingerprint) and pins the verified identity', async () => {
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        if (url === '/jmap/session') {
          expect((init?.headers as Record<string, string>)?.Authorization).toMatch(/^Basic /);
          return sessionResponse();
        }
        return jsonResponse({ error: 'not found' }, 404);
      });
      installFetch(fetchMock);

      const session = await jmapClient.authenticate('user@example.com', 'password');
      expect(session).toBeTruthy();
      expect(getStoredFingerprint()).toEqual(FINGERPRINT_A);
      expect((jmapClient as unknown as PrivateClient)._identityVerified).toBe(true);
    });    it('throws ServerIdentityChangedError when the stored fingerprint differs and never sends credentials', async () => {
      storeFingerprint(FINGERPRINT_A);
      const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_B);
        return jsonResponse(SESSION);
      });
      installFetch(fetchMock);

      await expect(jmapClient.authenticate('user@example.com', 'password'))
        .rejects.toBeInstanceOf(ServerIdentityChangedError);
      assertNoCredentialsSent(fetchMock);
    });

    it('proceeds and re-pins the new identity when the user explicitly confirms the change', async () => {
      storeFingerprint(FINGERPRINT_A);
      const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_B);
        if (url === '/jmap/session') return sessionResponse();
        return jsonResponse({ error: 'not found' }, 404);
      });
      installFetch(fetchMock);

      const session = await jmapClient.authenticate('user@example.com', 'password', { confirmIdentityChange: true });
      expect(session).toBeTruthy();
      expect(getStoredFingerprint()).toEqual(FINGERPRINT_B);
    });

    it('trusts an operator-allowlisted fingerprint without confirmation', async () => {
      storeFingerprint(FINGERPRINT_A);
      const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/server-fingerprint') {
          return jsonResponse({ ...FINGERPRINT_B, trusted: true });
        }
        if (url === '/jmap/session') return sessionResponse();
        return jsonResponse({ error: 'not found' }, 404);
      });
      installFetch(fetchMock);

      await expect(jmapClient.authenticate('user@example.com', 'password')).resolves.toBeTruthy();
    });

    it('degrades gracefully (fail open, with warning) when the fingerprint endpoint is unavailable', async () => {
      // Endpoint unavailable → no pinning possible → authenticate proceeds
      // through the normal variant flow (the endpoint ships with every
      // supported server configuration; this covers old-server pairings).
      const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/server-fingerprint') throw new TypeError('Failed to fetch');
        if (url === '/jmap/session') return sessionResponse();
        return jsonResponse({ error: 'not found' }, 404);
      });
      installFetch(fetchMock);

      await expect(jmapClient.authenticate('user@example.com', 'password')).resolves.toBeTruthy();
    });

    it('throws ServerUnreachableError when the configured backend host no longer resolves', async () => {
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(UNRESOLVED_FINGERPRINT);
        return jsonResponse(SESSION);
      });

      await expect(jmapClient.authenticate('user@example.com', 'password'))
        .rejects.toBeInstanceOf(ServerUnreachableError);
    });

    it('classifies a 502 response as ServerUnreachableError, not an auth failure', async () => {
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        return jsonResponse({ error: 'backend unavailable' }, 502);
      });

      await expect(jmapClient.authenticate('user@example.com', 'password'))
        .rejects.toBeInstanceOf(ServerUnreachableError);
    });

    it('classifies a 401 response as AuthError', async () => {
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        return jsonResponse({ error: 'unauthorized' }, 401);
      });

      const err = await jmapClient.authenticate('user@example.com', 'wrong').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AuthError);
    });

    it('classifies a fetch-level network failure as ServerUnreachableError', async () => {
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        throw new TypeError('Failed to fetch');
      });

      const err = await jmapClient.authenticate('user@example.com', 'password').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ServerUnreachableError);
    });
  });

  describe('request()', () => {
    it('refuses the request and clears the session when the identity changed', async () => {
      seedSession();
      storeFingerprint(FINGERPRINT_A);
      const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_B);
        return jmapOkResponse();
      });
      installFetch(fetchMock);

      await expect(jmapClient.request([['Email/get', { accountId: 'a1', ids: null }, '0']]))
        .rejects.toThrow('Not authenticated');
      expect(sessionStorage.getItem('jmap_session')).toBeNull();
      expect(sessionStorage.getItem('jmap_auth')).toBeNull();
      assertNoCredentialsSent(fetchMock);
    });

    it('sends credentials only after the identity check passes (with a stored fingerprint)', async () => {
      seedSession();
      storeFingerprint(FINGERPRINT_A);
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        if (url === '/jmap/') {
          expect((init?.headers as Record<string, string>)?.Authorization).toBe('Basic dGVzdDp0ZXN0');
          return jmapOkResponse();
        }
        return jsonResponse({ error: 'not found' }, 404);
      });
      installFetch(fetchMock);

      const result = await jmapClient.request([['Email/get', { accountId: 'a1', ids: null }, '0']]);
      expect(result.methodResponses[0][0]).toBe('Email/get');
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/server-fingerprint'))).toBe(true);
    });

    it('short-circuits the identity check when no stored fingerprint exists', async () => {
      // Legacy session without a stored fingerprint: there is nothing to
      // compare against, so the gate must not fetch (and must not block).
      seedSession();
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/server-fingerprint') return jsonResponse({ error: 'should not be called' }, 500);
        if (url === '/jmap/') {
          expect((init?.headers as Record<string, string>)?.Authorization).toBe('Basic dGVzdDp0ZXN0');
          return jmapOkResponse();
        }
        return jsonResponse({ error: 'not found' }, 404);
      });
      installFetch(fetchMock);

      const result = await jmapClient.request([['Email/get', { accountId: 'a1', ids: null }, '0']]);
      expect(result.methodResponses[0][0]).toBe('Email/get');
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/server-fingerprint'))).toBe(false);
    });

    it('classifies a 502 as ServerUnreachableError', async () => {
      seedSession();
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        return jsonResponse({ error: 'bad gateway' }, 502);
      });

      const err = await jmapClient.request([['Email/get', { accountId: 'a1', ids: null }, '0']]).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ServerUnreachableError);
    });

    it('classifies a network failure as ServerUnreachableError', async () => {
      seedSession();
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        throw new TypeError('Failed to fetch');
      });

      const err = await jmapClient.request([['Email/get', { accountId: 'a1', ids: null }, '0']]).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ServerUnreachableError);
    });

    it('classifies a 401 as AuthError and logs out', async () => {
      seedSession();
      const replaceMock = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: Object.assign(Object.create(Object.getPrototypeOf(originalLocation)), {
          ...originalLocation,
          replace: replaceMock,
        }),
      });
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        return jsonResponse({ error: 'unauthorized' }, 401);
      });

      const err = await jmapClient.request([['Email/get', { accountId: 'a1', ids: null }, '0']]).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AuthError);
      expect(sessionStorage.getItem('jmap_session')).toBeNull();
      expect(replaceMock).toHaveBeenCalledWith('/');
    });

    it('classifies other 5xx responses as JMAPProtocolError', async () => {
      seedSession();
      installFetch(async (url: string) => {
        if (url === '/api/server-fingerprint') return jsonResponse(FINGERPRINT_A);
        return jsonResponse({ error: 'internal' }, 500);
      });

      const err = await jmapClient.request([['Email/get', { accountId: 'a1', ids: null }, '0']]).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(JMAPProtocolError);
      expect((err as JMAPProtocolError).status).toBe(500);
    });
  });

  describe('verifyServerIdentity() boot states (issue #6)', () => {
    it("returns 'endpoint-unavailable' when the fingerprint endpoint is missing (fail open)", async () => {
      storeFingerprint(FINGERPRINT_A);
      seedSession();
      installFetch(async () => jsonResponse({ error: 'not found' }, 404));

      const status = await jmapClient.verifyServerIdentity();
      expect(status).toBe('endpoint-unavailable');
    });

    it("returns 'unreachable' when the backend host no longer resolves", async () => {
      storeFingerprint(FINGERPRINT_A);
      seedSession();
      installFetch(async () => jsonResponse(UNRESOLVED_FINGERPRINT));

      const status = await jmapClient.verifyServerIdentity();
      expect(status).toBe('unreachable');
    });

    it("returns 'verified' when the fingerprint matches", async () => {
      storeFingerprint(FINGERPRINT_A);
      seedSession();
      installFetch(async () => jsonResponse(FINGERPRINT_A));

      const status = await jmapClient.verifyServerIdentity();
      expect(status).toBe('verified');
    });

    it("returns 'identity-changed' and clears the session when the fingerprint differs", async () => {
      storeFingerprint(FINGERPRINT_A);
      seedSession();
      installFetch(async () => jsonResponse(FINGERPRINT_B));

      const status = await jmapClient.verifyServerIdentity();
      expect(status).toBe('identity-changed');
      expect((jmapClient as unknown as PrivateClient).session).toBeNull();
    });
  });
});
