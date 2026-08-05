/**
 * Extracts the Base64-encoded auth token from an Authorization header.
 * Handles both "Basic <token>" and raw token formats.
 *
 * Per RFC 7617 §2.1 the auth scheme is case-insensitive, so "Basic ",
 * "basic ", "BASIC " etc. are all normalized to the same prefix.
 *
 * @param authHeader The Authorization header value
 * @returns The extracted token (Base64-encoded credentials)
 */
export function extractAuthToken(authHeader: string): string {
  if (authHeader.toLowerCase().startsWith('basic ')) {
    return authHeader.slice(6); // Strip "Basic " prefix
  }
  return authHeader;
}

/**
 * Checks if the auth header appears to be a Basic auth header.
 * The scheme is case-insensitive per RFC 7617 §2.1.
 */
export function isBasicAuth(authHeader: string): boolean {
  return authHeader.toLowerCase().startsWith('basic ');
}
