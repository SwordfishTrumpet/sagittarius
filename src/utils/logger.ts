/**
 * Environment-gated logger for Sagittarius.
 *
 * SECURITY: logger.error() outputs in ALL environments including production.
 * NEVER pass JMAP response bodies, session objects, auth headers, or user
 * data (email content, addresses) to logger.error(). Use logger.debug() for
 * diagnostic data that contains PII or credentials.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.log('[Sagittarius]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[Sagittarius]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[Sagittarius]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[Sagittarius]', ...args);
  },
};

/**
 * Redact sensitive query parameters (access_token) from URLs before logging.
 */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    if (u.searchParams.has('access_token')) {
      u.searchParams.set('access_token', '[REDACTED]');
    }
    return u.toString();
  } catch {
    return url.replace(/access_token=[^&]+/, 'access_token=[REDACTED]');
  }
}
