import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fingerprintKey,
  getStoredFingerprint,
  storeFingerprint,
  clearFingerprint,
  fetchServerFingerprint,
  ServerIdentityChangedError,
  isServerIdentityChangedError,
  type ServerFingerprint,
} from '../serverFingerprint';

const BASE_FINGERPRINT: ServerFingerprint = {
  host: 'mail.example.com',
  scheme: 'https',
  resolved: true,
  addresses: ['1.2.3.4'],
  certFingerprint: 'sha256:abc123',
  trusted: false,
  error: null,
};

describe('serverFingerprint (client)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fingerprintKey', () => {
    it('mirrors the server-side key computation', () => {
      expect(fingerprintKey(BASE_FINGERPRINT)).toBe('https|mail.example.com|sha256:abc123');
      expect(fingerprintKey({
        host: 'mail.example.com',
        scheme: 'http',
        addresses: ['1.2.3.4', '5.6.7.8'],
      })).toBe('http|mail.example.com|1.2.3.4,5.6.7.8');
    });

    it('returns null for non-comparable fingerprints', () => {
      expect(fingerprintKey(null)).toBeNull();
      expect(fingerprintKey({ ...BASE_FINGERPRINT, certFingerprint: null })).toBeNull();
      expect(fingerprintKey({ ...BASE_FINGERPRINT, scheme: 'ftp' })).toBeNull();
    });
  });

  describe('storage', () => {
    it('round-trips a fingerprint through sessionStorage', () => {
      expect(getStoredFingerprint()).toBeNull();
      storeFingerprint(BASE_FINGERPRINT);
      expect(getStoredFingerprint()).toEqual(BASE_FINGERPRINT);
      clearFingerprint();
      expect(getStoredFingerprint()).toBeNull();
    });

    it('tolerates corrupt stored data', () => {
      sessionStorage.setItem('jmap_server_fingerprint', '{not json');
      expect(getStoredFingerprint()).toBeNull();
    });
  });

  describe('fetchServerFingerprint', () => {
    it('fetches and parses the endpoint response', async () => {
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('/api/server-fingerprint');
        return new Response(JSON.stringify(BASE_FINGERPRINT), { status: 200 });
      }));

      await expect(fetchServerFingerprint()).resolves.toEqual(BASE_FINGERPRINT);
    });

    it('returns null (degraded) on a non-200 response', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })));
      await expect(fetchServerFingerprint()).resolves.toBeNull();
    });

    it('returns null (degraded) on a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }));
      await expect(fetchServerFingerprint()).resolves.toBeNull();
    });

    it('returns null (degraded) on a malformed response body', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>index</html>', { status: 200 })));
      await expect(fetchServerFingerprint()).resolves.toBeNull();
    });

    it('returns null (degraded) when required fields are missing', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{"host":"x"}', { status: 200 })));
      await expect(fetchServerFingerprint()).resolves.toBeNull();
    });
  });

  describe('ServerIdentityChangedError', () => {
    it('carries both fingerprints and is detected by kind', () => {
      const previous = { ...BASE_FINGERPRINT, certFingerprint: 'sha256:old' };
      const err = new ServerIdentityChangedError(previous, BASE_FINGERPRINT);
      expect(err.previousFingerprint).toBe(previous);
      expect(err.currentFingerprint).toBe(BASE_FINGERPRINT);
      expect(err.message).toContain('identity changed');
      expect(isServerIdentityChangedError(err)).toBe(true);
      expect(isServerIdentityChangedError(new Error('x'))).toBe(false);
      expect(isServerIdentityChangedError(null)).toBe(false);
    });
  });
});
