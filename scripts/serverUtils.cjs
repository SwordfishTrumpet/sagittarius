/**
 * Shared server-side utilities for the Sagittarius production servers
 * (server.js and server.cjs) and the Vite dev proxy (vite.config.ts).
 *
 * Server-identity fingerprinting (issue #1): the client pins the identity of
 * the configured JMAP backend so that a lapsed-and-re-registered domain
 * cannot harvest Basic-auth credentials. This module computes that
 * fingerprint from the DNS A/AAAA records and (for https backends) the
 * SHA-256 hash of the TLS leaf certificate presented by whatever host
 * currently answers the configured name.
 *
 * CJS by design: server.cjs (CommonJS) and server.js / vite.config.ts (ESM)
 * can both load it (ESM imports the CJS default export).
 */
'use strict';

const dns = require('dns');
const tls = require('tls');
const net = require('net');
const crypto = require('crypto');

const FINGERPRINT_TIMEOUT_MS = 5000;

function parseJmapServer(serverUrl) {
  try {
    return new URL(serverUrl);
  } catch {
    return null;
  }
}

/** DNS names are case-insensitive and a trailing dot is the root suffix. */
function normalizeHost(host) {
  return String(host || '').replace(/\.$/, '').toLowerCase();
}

/**
 * Redact sensitive query parameters (access_token) from URLs before logging.
 * Must stay in sync with src/utils/logger.ts `redactUrl()` (client) and
 * vite.config.ts `redactProxyUrl()` (dev proxy) — issue #2: production
 * servers must never persist live Basic-auth credentials in logs.
 */
function redactUrl(url) {
  if (typeof url !== 'string' || !url) return url;
  try {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.searchParams.has('access_token')) {
      parsed.searchParams.set('access_token', '[REDACTED]');
    }
    return parsed.toString();
  } catch {
    // Replace EVERY access_token=... occurrence (global flag) so URLs with
    // duplicate tokens never leak a second token.
    return url.replace(/access_token=[^&]+/g, 'access_token=[REDACTED]');
  }
}

/**
 * Resolve A + AAAA records for a host, falling back to the system resolver.
 * Returns a sorted, de-duplicated address list (stable for comparison).
 * `dnsImpl` is injectable for tests (defaults to Node's dns.promises).
 */
async function resolveAddresses(host, dnsImpl) {
  const resolver = dnsImpl || dns.promises;
  const out = new Set();
  const push = (value) => {
    if (value) out.add(value);
  };
  try {
    const a = await resolver.resolve4(host);
    a.forEach(push);
  } catch {
    // IPv4 may simply not exist for this name.
  }
  try {
    const aaaa = await resolver.resolve6(host);
    aaaa.forEach(push);
  } catch {
    // IPv6 may simply not exist for this name.
  }
  if (out.size === 0) {
    // Fall back to the system resolver (handles /etc/hosts, search domains).
    try {
      const entries = await resolver.lookup(host, { all: true });
      entries.forEach((entry) => push(entry.address));
    } catch {
      // Unresolvable.
    }
  }
  return Array.from(out).sort();
}

function getPeerCertFingerprint(socket) {
  const cert = socket.getPeerCertificate();
  if (!cert || !cert.raw || cert.raw.length === 0) return null;
  return `sha256:${crypto.createHash('sha256').update(cert.raw).digest('hex')}`;
}

/**
 * Connect (without validating) to the https endpoint and read the leaf
 * certificate the currently-answering host presents. This is deliberately
 * NOT a normal TLS validation: the entire point is to fingerprint whatever
 * server currently answers the name, attacker-controlled or not.
 * `tlsImpl` is injectable for tests (defaults to Node's tls).
 */
function fetchTlsFingerprint(url, tlsImpl, timeoutMs) {
  const tlsLib = tlsImpl || tls;
  const port = url.port ? Number(url.port) : 443;
  return new Promise((resolve) => {
    let settled = false;
    const socket = tlsLib.connect({
      host: url.hostname,
      port,
      servername: url.hostname,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ fingerprint: null, error: 'TLS handshake timed out' });
    }, timeoutMs);
    const finish = (fingerprint, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ fingerprint, error: error || null });
    };
    socket.once('secureConnect', () => finish(getPeerCertFingerprint(socket), null));
    socket.once('error', (err) => finish(null, err && err.message ? err.message : String(err)));
  });
}

function normalizeFingerprintValue(value) {
  return String(value || '').trim().replace(/^sha256:/i, '').toLowerCase();
}

/**
 * Compute the identity fingerprint of the configured JMAP backend.
 *
 * Returns a stable shape consumed by the /api/server-fingerprint endpoint:
 *   { host, scheme, resolved, addresses, certFingerprint, trusted, error }
 *
 * - `resolved: false` — the hostname no longer resolves (dead backend /
 *   domain lapse). The client treats this as "server unreachable".
 * - `certFingerprint` — `sha256:<hex>` of the leaf cert (https only).
 * - `trusted` — true when the current fingerprint is listed in the
 *   operator-configured allowlist (JMAP_TRUSTED_FINGERPRINTS).
 */
async function computeServerFingerprint(serverUrl, options = {}) {
  const {
    trustedFingerprints = [],
    timeoutMs = FINGERPRINT_TIMEOUT_MS,
    // Injectable for tests; production callers rely on the defaults.
    dnsImpl,
    tlsImpl,
  } = options;
  const url = parseJmapServer(serverUrl);
  if (!url) {
    return {
      host: null,
      scheme: null,
      resolved: false,
      addresses: [],
      certFingerprint: null,
      trusted: false,
      error: 'Invalid JMAP_SERVER URL',
    };
  }

  const host = normalizeHost(url.hostname);
  const scheme = String(url.protocol).replace(':', '');

  let addresses = [];
  try {
    addresses = await resolveAddresses(host, dnsImpl);
  } catch {
    addresses = [];
  }
  if (addresses.length === 0) {
    return {
      host,
      scheme,
      resolved: false,
      addresses: [],
      certFingerprint: null,
      trusted: false,
      error: 'DNS resolution failed',
    };
  }

  let certFingerprint = null;
  let tlsError = null;
  if (scheme === 'https') {
    const result = await fetchTlsFingerprint(url, tlsImpl, timeoutMs);
    certFingerprint = result.fingerprint;
    tlsError = result.error;
    if (!certFingerprint) {
      // DNS resolves but TLS fails: the host answers yet cannot present a
      // certificate. Treat as cannot-verify (client blocks credentials).
      return {
        host,
        scheme,
        resolved: true,
        addresses,
        certFingerprint: null,
        trusted: false,
        error: tlsError || 'TLS fingerprint unavailable',
      };
    }
  }

  const trusted = Array.isArray(trustedFingerprints)
    && trustedFingerprints.some((entry) => {
      if (!entry || !certFingerprint) return false;
      return normalizeFingerprintValue(entry) === normalizeFingerprintValue(certFingerprint);
    });

  return {
    host,
    scheme,
    resolved: true,
    addresses,
    certFingerprint,
    trusted,
    error: tlsError,
  };
}

/**
 * Stable comparison key for a fingerprint. Two fingerprints with the same key
 * are the same identity. https backends are pinned by cert hash; http (dev)
 * backends are pinned by the resolved address set.
 */
function fingerprintKey(fingerprint) {
  if (!fingerprint || !fingerprint.host) return null;
  if (fingerprint.scheme === 'https' && fingerprint.certFingerprint) {
    return `https|${fingerprint.host}|${fingerprint.certFingerprint}`;
  }
  if (fingerprint.scheme === 'http') {
    return `http|${fingerprint.host}|${(fingerprint.addresses || []).join(',')}`;
  }
  return null;
}

/**
 * Decide what a startup reachability probe means for boot (issue #9).
 * Pure function so the boot policy is deterministic and unit-testable:
 *  - DNS unresolvable → loud warning; with fail-fast opted in, abort boot.
 *  - resolved but connection probe failed → warning (backend may be down).
 *  - fully reachable → info.
 * Returns { level: 'info'|'warn'|'error', message, shouldExit }.
 */
function startupProbeDecision(probe, options = {}) {
  const failFast = options.failFastOnUnresolved === true;
  if (!probe || probe.resolved === false) {
    const host = probe && probe.host ? probe.host : '(unknown)';
    const message = `WARNING: JMAP backend host ${host} did not resolve (DNS). Check JMAP_SERVER configuration and the backend's DNS records.`;
    return { level: failFast ? 'error' : 'warn', message, shouldExit: failFast };
  }
  if (probe.reachable === false) {
    return {
      level: 'warn',
      message: `WARNING: JMAP backend host ${probe.host} resolves but did not answer a connection probe — the backend may be down.`,
      shouldExit: false,
    };
  }
  return { level: 'info', message: `JMAP backend ${probe.host} is reachable.`, shouldExit: false };
}

/**
 * Probe the reachability of the configured JMAP backend (issues #7/#9):
 * DNS resolution plus a connection probe — TLS handshake for https, TCP
 * connect for http. Used by the startup validation (issue #9) and the
 * /health endpoint (issue #7). Injectable dnsImpl/tlsImpl/netImpl keep
 * the tests deterministic (no network).
 *
 * Always resolves to a shaped result, never throws:
 *   { host, scheme, resolved, reachable, addresses, latencyMs, error }
 */
async function probeBackendReachability(serverUrl, options = {}) {
  const { timeoutMs = 3000, dnsImpl, tlsImpl, netImpl } = options;
  const url = parseJmapServer(serverUrl);
  if (!url) {
    return {
      host: null,
      scheme: null,
      resolved: false,
      reachable: false,
      addresses: [],
      latencyMs: 0,
      error: 'Invalid JMAP_SERVER URL',
    };
  }
  const host = normalizeHost(url.hostname);
  const scheme = String(url.protocol).replace(':', '');
  const base = { host, scheme };

  const work = (async () => {
    const start = Date.now();
    let addresses = [];
    try {
      addresses = await resolveAddresses(host, dnsImpl);
    } catch {
      addresses = [];
    }
    if (addresses.length === 0) {
      return {
        ...base,
        resolved: false,
        reachable: false,
        addresses: [],
        latencyMs: Date.now() - start,
        error: 'DNS resolution failed',
      };
    }

    const port = url.port ? Number(url.port) : (scheme === 'https' ? 443 : 80);
    let reachable = false;
    let connectError = null;
    if (scheme === 'https') {
      const tlsResult = await fetchTlsFingerprint(url, tlsImpl, timeoutMs);
      reachable = !!tlsResult.fingerprint;
      connectError = tlsResult.error;
    } else {
      const netLib = netImpl || net;
      reachable = await new Promise((resolve) => {
        let socket;
        try {
          socket = netLib.connect({ host, port });
        } catch (err) {
          resolve(false);
          return;
        }
        const timer = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, timeoutMs);
        socket.once('connect', () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(false);
        });
      });
      if (!reachable) connectError = 'TCP connect failed';
    }
    return {
      ...base,
      resolved: true,
      reachable,
      addresses,
      latencyMs: Date.now() - start,
      error: connectError,
    };
  })();

  // Overall deadline: a hanging DNS resolver must not stall boot or health.
  const overall = new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ...base,
        resolved: false,
        reachable: false,
        addresses: [],
        latencyMs: 0,
        error: 'Probe timed out',
      });
    }, timeoutMs + 1000);
  });

  return Promise.race([work, overall]);
}

function parseTrustedFingerprints(raw) {
  if (!raw) return [];
  return String(raw).split(',').map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Unified proxy failure response (issue #8): every production server and the
 * Vite dev proxy must answer backend-outage 502s with the same JSON shape so
 * clients can classify the failure class without parsing divergent bodies.
 * No-ops when headers were already sent (e.g. a partial streamed response).
 */
function writeBadGatewayResponse(res) {
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'JMAP backend unavailable' }));
  }
}

module.exports = {
  parseJmapServer,
  resolveAddresses,
  computeServerFingerprint,
  fingerprintKey,
  parseTrustedFingerprints,
  normalizeFingerprintValue,
  redactUrl,
  writeBadGatewayResponse,
  probeBackendReachability,
  startupProbeDecision,
  FINGERPRINT_TIMEOUT_MS,
};
