/**
 * Shared JMAP error taxonomy (issue #4/#5 groundwork, introduced with the
 * server-identity work of issue #1).
 *
 * Every error raised by the JMAP client carries a `kind` marker so callers
 * can discriminate failure classes without relying on `instanceof` (which is
 * fragile across duplicated module instances in tests):
 *
 *   - `auth`             — 401/403 responses: credentials were rejected.
 *   - `server-unreachable` — fetch-level failures, 502/503/504, DNS/TLS
 *                          failures surfaced by the proxy: the backend is
 *                          gone, credentials are probably fine.
 *   - `protocol`         — everything else (5xx, malformed responses, JMAP
 *                          method errors surfaced by the caller).
 */

export type JMAPErrorKind = 'auth' | 'server-unreachable' | 'protocol';

function makeKind(kind: JMAPErrorKind) {
  return kind;
}

export class AuthError extends Error {
  readonly kind: JMAPErrorKind = makeKind('auth');
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ServerUnreachableError extends Error {
  readonly kind: JMAPErrorKind = makeKind('server-unreachable');
  readonly retryable = true;

  constructor(message: string) {
    super(message);
    this.name = 'ServerUnreachableError';
  }
}

export class JMAPProtocolError extends Error {
  readonly kind: JMAPErrorKind = makeKind('protocol');
  readonly retryable = true;
  readonly status: number | null;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'JMAPProtocolError';
    this.status = status ?? null;
  }
}

function getKind(err: unknown): JMAPErrorKind | null {
  if (err && typeof err === 'object' && 'kind' in err) {
    const kind = (err as { kind?: unknown }).kind;
    if (kind === 'auth' || kind === 'server-unreachable' || kind === 'protocol') return kind;
  }
  return null;
}

export function isAuthError(err: unknown): err is AuthError {
  return getKind(err) === 'auth';
}

export function isServerUnreachableError(err: unknown): err is ServerUnreachableError {
  return getKind(err) === 'server-unreachable';
}

export function isJMAPProtocolError(err: unknown): err is JMAPProtocolError {
  return getKind(err) === 'protocol';
}

/**
 * Classify an arbitrary thrown value (with an optional HTTP status) into the
 * shared taxonomy. Unknown values without a status default to `protocol`.
 */
export function classifyJMAPError(err: unknown, status?: number): JMAPErrorKind {
  const kind = getKind(err);
  if (kind) return kind;
  if (status !== undefined) {
    if (status === 401 || status === 403) return 'auth';
    if (status >= 502 && status <= 504) return 'server-unreachable';
    return 'protocol';
  }
  return 'protocol';
}

/**
 * User-facing message for a JMAP failure, keyed by the error class (issue
 * #8). UI components must render THIS instead of raw error messages like
 * `JMAP request failed: 502` — users need to know whether their session
 * expired, the mail server is gone, or the server misbehaved, and never
 * see internal status strings.
 */
export function getUserFacingJMAPErrorMessage(err: unknown): string {
  const kind = getKind(err);
  if (kind === 'auth') {
    return 'Your session has expired. Please sign in again.';
  }
  if (kind === 'server-unreachable') {
    return 'Mail server unreachable. Please check that the mail server is running and try again.';
  }
  if (kind === 'protocol') {
    const status = err && typeof err === 'object' && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;
    if (typeof status === 'number') {
      return `The mail server returned an error (HTTP ${status}). Please try again.`;
    }
    return 'The mail server returned an error. Please try again.';
  }
  return 'An unexpected error occurred. Please try again.';
}
