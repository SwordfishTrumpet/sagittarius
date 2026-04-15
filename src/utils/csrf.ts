/**
 * CSRF Protection Utilities
 * Provides client-side CSRF token generation and validation
 */

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or create a CSRF token for the current session
 */
export function getCsrfToken(): string {
  try {
    let token = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!token) {
      token = generateToken();
      sessionStorage.setItem(CSRF_TOKEN_KEY, token);
    }
    return token;
  } catch {
    // Fallback if storage is unavailable
    return generateToken();
  }
}

/**
 * Get the CSRF header name for HTTP requests
 */
export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}

/**
 * Create headers object with CSRF token included
 */
export function createCsrfHeaders(existingHeaders?: Record<string, string>): Record<string, string> {
  return {
    ...existingHeaders,
    [CSRF_HEADER_NAME]: getCsrfToken(),
  };
}

/**
 * Clear the CSRF token (e.g., on logout)
 */
export function clearCsrfToken(): void {
  try {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Regenerate the CSRF token (e.g., after authentication)
 */
export function regenerateCsrfToken(): string {
  clearCsrfToken();
  return getCsrfToken();
}
