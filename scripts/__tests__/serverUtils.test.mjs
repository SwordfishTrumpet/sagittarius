/**
 * Tests for scripts/serverUtils.cjs — the server-identity fingerprint
 * computation shared by server.js, server.cjs and the Vite dev proxy
 * (issue #1).
 *
 * DNS and TLS are injected via `dnsImpl` / `tlsImpl` so the tests are
 * deterministic and need no network access.
 */
import crypto from 'crypto';
import { describe, it, expect, vi } from 'vitest';
import serverUtils from '../serverUtils.cjs';

const {
  computeServerFingerprint,
  fingerprintKey,
  parseTrustedFingerprints,
  normalizeFingerprintValue,
  redactUrl,
  writeBadGatewayResponse,
} = serverUtils;

function makeFakeDns({ resolve4, resolve6, lookup } = {}) {
  return {
    resolve4: resolve4 ?? (async () => { throw new Error('no A records'); }),
    resolve6: resolve6 ?? (async () => { throw new Error('no AAAA records'); }),
    lookup: lookup ?? (async () => { throw new Error('unresolvable'); }),
  };
}

function makeFakeTls({ certRaw = null, error = null } = {}) {
  const connect = vi.fn(() => {
    const handlers = {};
    const socket = {
      once(event, cb) {
        handlers[event] = cb;
        return socket;
      },
      destroy: vi.fn(),
      getPeerCertificate() {
        return certRaw ? { raw: certRaw } : {};
      },
    };
    setImmediate(() => {
      if (error) {
        if (handlers.error) handlers.error(new Error(error));
      } else if (handlers.secureConnect) {
        handlers.secureConnect();
      }
    });
    return socket;
  });
  return { connect };
}

function certHash(raw) {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

describe('serverUtils (server-identity fingerprint)', () => {
  describe('computeServerFingerprint', () => {
    it('returns unresolved for an invalid JMAP_SERVER URL', async () => {
      const fp = await computeServerFingerprint('not a url');
      expect(fp.resolved).toBe(false);
      expect(fp.error).toContain('Invalid');
    });

    it('resolves an http backend to sorted DNS addresses without a cert', async () => {
      const fp = await computeServerFingerprint('http://mail.example.com:8080', {
        dnsImpl: makeFakeDns({
          resolve4: async () => ['1.2.3.4'],
          resolve6: async () => ['2001:db8::1'],
        }),
      });
      expect(fp.resolved).toBe(true);
      expect(fp.scheme).toBe('http');
      expect(fp.host).toBe('mail.example.com');
      expect(fp.addresses).toEqual(['1.2.3.4', '2001:db8::1']);
      expect(fp.certFingerprint).toBeNull();
      expect(fp.trusted).toBe(false);
    });

    it('falls back to the system resolver when A/AAAA lookups fail', async () => {
      const fp = await computeServerFingerprint('https://mail.example.com', {
        dnsImpl: makeFakeDns({
          lookup: async () => [{ address: '10.0.0.5' }],
        }),
      });
      expect(fp.resolved).toBe(true);
      expect(fp.addresses).toEqual(['10.0.0.5']);
    });

    it('reports unresolved when the hostname no longer resolves (domain lapse)', async () => {
      const fp = await computeServerFingerprint('https://lapsed.example.com', {
        dnsImpl: makeFakeDns(),
      });
      expect(fp.resolved).toBe(false);
      expect(fp.addresses).toEqual([]);
      expect(fp.certFingerprint).toBeNull();
      expect(fp.error).toContain('DNS');
    });

    it('fingerprints the TLS leaf certificate for https backends', async () => {
      const raw = Buffer.from('fake-der-certificate-bytes');
      const fp = await computeServerFingerprint('https://mail.example.com', {
        dnsImpl: makeFakeDns({ resolve4: async () => ['1.2.3.4'] }),
        tlsImpl: makeFakeTls({ certRaw: raw }),
      });
      expect(fp.resolved).toBe(true);
      expect(fp.scheme).toBe('https');
      expect(fp.certFingerprint).toBe(certHash(raw));
      expect(fp.error).toBeNull();
    });

    it('reports cannot-verify when the TLS handshake fails', async () => {
      const fp = await computeServerFingerprint('https://mail.example.com', {
        dnsImpl: makeFakeDns({ resolve4: async () => ['1.2.3.4'] }),
        tlsImpl: makeFakeTls({ error: 'socket hang up' }),
      });
      expect(fp.resolved).toBe(true);
      expect(fp.certFingerprint).toBeNull();
      expect(fp.error).toContain('socket hang up');
    });

    it('marks the fingerprint trusted when it matches the operator allowlist', async () => {
      const raw = Buffer.from('cert-bytes');
      const fp = await computeServerFingerprint('https://mail.example.com', {
        trustedFingerprints: [certHash(raw)],
        dnsImpl: makeFakeDns({ resolve4: async () => ['1.2.3.4'] }),
        tlsImpl: makeFakeTls({ certRaw: raw }),
      });
      expect(fp.trusted).toBe(true);
    });

    it('accepts allowlist entries without the sha256: prefix', async () => {
      const raw = Buffer.from('cert-bytes');
      const fp = await computeServerFingerprint('https://mail.example.com', {
        trustedFingerprints: [crypto.createHash('sha256').update(raw).digest('hex')],
        dnsImpl: makeFakeDns({ resolve4: async () => ['1.2.3.4'] }),
        tlsImpl: makeFakeTls({ certRaw: raw }),
      });
      expect(fp.trusted).toBe(true);
    });

    it('does not trust a non-matching allowlist', async () => {
      const fp = await computeServerFingerprint('https://mail.example.com', {
        trustedFingerprints: ['sha256:'.concat('ab'.repeat(32))],
        dnsImpl: makeFakeDns({ resolve4: async () => ['1.2.3.4'] }),
        tlsImpl: makeFakeTls({ certRaw: Buffer.from('cert-a') }),
      });
      expect(fp.trusted).toBe(false);
    });
  });

  describe('fingerprintKey', () => {
    it('pins https backends by cert hash', () => {
      expect(fingerprintKey({
        host: 'mail.example.com',
        scheme: 'https',
        certFingerprint: 'sha256:abc',
      })).toBe('https|mail.example.com|sha256:abc');
    });

    it('pins http backends by the sorted address set', () => {
      expect(fingerprintKey({
        host: 'mail.example.com',
        scheme: 'http',
        addresses: ['1.2.3.4', '5.6.7.8'],
      })).toBe('http|mail.example.com|1.2.3.4,5.6.7.8');
    });

    it('returns null when no comparable identity exists', () => {
      expect(fingerprintKey({ host: null, scheme: null })).toBeNull();
      expect(fingerprintKey({ host: 'x', scheme: 'https', certFingerprint: null })).toBeNull();
    });
  });

  describe('parseTrustedFingerprints', () => {
    it('splits, trims and filters the env list', () => {
      expect(parseTrustedFingerprints(' sha256:aa ,  ,sha256:bb ')).toEqual(['sha256:aa', 'sha256:bb']);
      expect(parseTrustedFingerprints(undefined)).toEqual([]);
      expect(parseTrustedFingerprints('')).toEqual([]);
    });
  });

  describe('normalizeFingerprintValue', () => {
    it('strips sha256: prefix and lowercases', () => {
      expect(normalizeFingerprintValue('sha256:ABC123')).toBe('abc123');
      expect(normalizeFingerprintValue('ABC123')).toBe('abc123');
    });
  });

  describe('writeBadGatewayResponse (issue #8)', () => {
    function makeFakeRes(overrides = {}) {
      const res = {
        headersSent: false,
        statusCode: null,
        headers: null,
        body: '',
        writeHead(status, headers) {
          this.statusCode = status;
          this.headers = headers;
        },
        end(body) {
          this.body = String(body);
        },
        ...overrides,
      };
      return res;
    }

    it('writes the unified 502 JSON shape used by every server', () => {
      const res = makeFakeRes();
      writeBadGatewayResponse(res);
      expect(res.statusCode).toBe(502);
      expect(res.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(res.body)).toEqual({ error: 'JMAP backend unavailable' });
    });

    it('is a no-op when headers were already sent (partial stream)', () => {
      const res = makeFakeRes({ headersSent: true });
      writeBadGatewayResponse(res);
      expect(res.statusCode).toBeNull();
      expect(res.body).toBe('');
    });

    it('tolerates a socket (WebSocket upgrade error) or null', () => {
      const socket = { destroy: vi.fn() };
      expect(() => writeBadGatewayResponse(socket)).not.toThrow();
      expect(() => writeBadGatewayResponse(null)).not.toThrow();
    });
  });

  describe('redactUrl (issue #2)', () => {
    it('redacts a single access_token parameter', () => {
      expect(redactUrl('/jmap/eventsource?access_token=c2VjcmV0')).toBe('http://localhost/jmap/eventsource?access_token=%5BREDACTED%5D');
    });

    it('keeps other query parameters intact', () => {
      expect(redactUrl('/jmap/ws?types=*&access_token=c2VjcmV0&closeafter=no'))
        .toBe('http://localhost/jmap/ws?types=*&access_token=%5BREDACTED%5D&closeafter=no');
    });

    it('collapses duplicate token params in parseable URLs (still no leak)', () => {
      // URLSearchParams keeps one value per key; the values are replaced,
      // so no token survives regardless of how many were present.
      expect(redactUrl('not-a-url?access_token=one&access_token=two'))
        .toBe('http://localhost/not-a-url?access_token=%5BREDACTED%5D');
    });

    it('redacts every token occurrence in unparseable URLs (global regex fallback)', () => {
      // Invalid port → new URL() throws → the regex fallback must replace
      // EVERY access_token=… occurrence, not just the first.
      expect(redactUrl('http://x:99999/evil?access_token=one&access_token=two'))
        .toBe('http://x:99999/evil?access_token=[REDACTED]&access_token=[REDACTED]');
    });

    it('leaves URLs without a token untouched', () => {
      expect(redactUrl('/jmap/session')).toBe('http://localhost/jmap/session');
      expect(redactUrl(null)).toBeNull();
      expect(redactUrl(undefined)).toBeUndefined();
    });
  });
});
