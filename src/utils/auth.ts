/**
 * Extracts the Base64-encoded auth token from an Authorization header.
 * Handles both "Basic <token>" and raw token formats.
 *
 * @param authHeader The Authorization header value
 * @returns The extracted token (Base64-encoded credentials)
 */
export function extractAuthToken(authHeader: string): string {
  if (authHeader.startsWith('Basic ')) {
    return authHeader.slice(6); // Strip "Basic " prefix
  }
  return authHeader;
}

/**
 * Checks if the auth header appears to be a Basic auth header.
 */
export function isBasicAuth(authHeader: string): boolean {
  return authHeader.startsWith('Basic ');
}
