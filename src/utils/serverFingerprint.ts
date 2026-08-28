/**
 * Client-side server-identity fingerprinting (issue #1).
 *
 * The browser never sees the JMAP backend's TLS certificate directly (all
 * traffic flows through the same-origin /jmap proxy), so the fingerprint is
 * computed server-side by /api/server-fingerprint (scripts/serverUtils.cjs)
 * and compared here against the fingerprint persisted with the session.
 *
 * A changed fingerprint means the configured backend name now resolves to a
 * different server (lapsed-and-re-registered domain, operator migration).
 * Credentials must never be transmitted to a changed identity until the user
 * explicitly confirms — this module is the enforcement point.
 */

export interface ServerFingerprint {
  host: string | null;
  scheme: string | null;
  /** false when the configured backend hostname no longer resolves. */
  resolved: boolean;
  addresses: string[];
  /** `sha256:<hex>` of the leaf TLS certificate (https backends only). */
  certFingerprint: string | null;
  /** true when the fingerprint matches the operator allowlist. */
  trusted: boolean;
  error: string | null;
}

const STORAGE_KEY = 'jmap_server_fingerprint';
const FETCH_TIMEOUT_MS = 8000;

/** The subset of the fingerprint used for identity comparison. */
export type FingerprintIdentity = Pick<ServerFingerprint, 'host' | 'scheme'> & Partial<
  Pick<ServerFingerprint, 'certFingerprint' | 'addresses'>
>;

/**
 * Stable comparison key. Mirrors scripts/serverUtils.cjs `fingerprintKey()`;
 * the duplication is deliberate — the browser bundle cannot import Node
 * builtins (dns/tls/crypto).
 */
export function fingerprintKey(fingerprint: FingerprintIdentity | null): string | null {
  if (!fingerprint || !fingerprint.host) return null;
  if (fingerprint.scheme === 'https' && fingerprint.certFingerprint) {
    return `https|${fingerprint.host}|${fingerprint.certFingerprint}`;
  }
  if (fingerprint.scheme === 'http') {
    return `http|${fingerprint.host}|${(fingerprint.addresses || []).join(',')}`;
  }
  return null;
}

/** Structural validation of a fingerprint object from the endpoint. */
export function isValidServerFingerprint(value: unknown): value is ServerFingerprint {
  if (!value || typeof value !== 'object') return false;
  const fp = value as Partial<ServerFingerprint>;
  return (
    typeof fp.host === 'string'
    && (fp.scheme === 'http' || fp.scheme === 'https')
    && typeof fp.resolved === 'boolean'
    && Array.isArray(fp.addresses)
    && (fp.certFingerprint === null || typeof fp.certFingerprint === 'string')
    && typeof fp.trusted === 'boolean'
  );
}

export function getStoredFingerprint(): ServerFingerprint | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ServerFingerprint) : null;
  } catch {
    return null;
  }
}

export function storeFingerprint(fingerprint: ServerFingerprint): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fingerprint));
  } catch {
    // sessionStorage can throw in private mode / constrained environments.
  }
}

export function clearFingerprint(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Fetch the current backend fingerprint from the same-origin app server.
 *
 * Returns `null` (and logs a warning) when the endpoint is unavailable or
 * returns a malformed response — the app then degrades gracefully WITHOUT
 * the pinning guarantee. The endpoint ships with server.js, server.cjs and
 * the Vite dev proxy, so in supported configurations this only happens when
 * an old server is paired with a new client or the endpoint is blocked.
 */
export async function fetchServerFingerprint(): Promise<ServerFingerprint | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch('/api/server-fingerprint', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn('[Sagittarius] Server-identity endpoint unavailable (HTTP ' + response.status + ') — proceeding without identity pinning.');
      return null;
    }
    const data: unknown = await response.json();
    if (!isValidServerFingerprint(data)) {
      // eslint-disable-next-line no-console
      console.warn('[Sagittarius] Server-identity endpoint returned a malformed response — proceeding without identity pinning.');
      return null;
    }
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Sagittarius] Unable to reach the server-identity endpoint — proceeding without identity pinning.', err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Thrown by `jmapClient.authenticate()` when the stored session fingerprint
 * differs from the current backend identity and the user has not yet
 * confirmed the change. The login screen renders the confirmation UI.
 */
export class ServerIdentityChangedError extends Error {
  readonly kind = 'server-identity-changed' as const;
  readonly previousFingerprint: ServerFingerprint | null;
  readonly currentFingerprint: ServerFingerprint;

  constructor(previous: ServerFingerprint | null, current: ServerFingerprint) {
    super(
      'The mail server identity changed since your last sign-in',
    );
    this.name = 'ServerIdentityChangedError';
    this.previousFingerprint = previous;
    this.currentFingerprint = current;
  }
}

export function isServerIdentityChangedError(err: unknown): err is ServerIdentityChangedError {
  return Boolean(
    err
    && typeof err === 'object'
    && (err as { kind?: unknown }).kind === 'server-identity-changed',
  );
}
