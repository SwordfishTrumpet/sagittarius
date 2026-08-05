import { describe, it, expect } from 'vitest';
import { extractAuthToken, isBasicAuth } from '../auth';

describe('auth', () => {
  describe('extractAuthToken', () => {
    it('should strip Basic prefix from auth header', () => {
      const result = extractAuthToken('Basic dXNlcjpwYXNz');
      expect(result).toBe('dXNlcjpwYXNz');
    });

    it('should return raw token if no Basic prefix', () => {
      const result = extractAuthToken('dXNlcjpwYXNz');
      expect(result).toBe('dXNlcjpwYXNz');
    });

    it('should handle empty string', () => {
      const result = extractAuthToken('');
      expect(result).toBe('');
    });

    it('should handle token with special characters', () => {
      const token = 'dXNlcjpwYXNzMTIzIQ==';
      const result = extractAuthToken(`Basic ${token}`);
      expect(result).toBe(token);
    });

    it('should preserve case in token', () => {
      const result = extractAuthToken('Basic QWJjMTIz');
      expect(result).toBe('QWJjMTIz');
    });

    it('should handle Basic with single space', () => {
      const result = extractAuthToken('Basic dXNlcjpwYXNz');
      expect(result).toBe('dXNlcjpwYXNz');
    });
  });

  describe('isBasicAuth', () => {
    it('should return true for Basic auth header', () => {
      expect(isBasicAuth('Basic dXNlcjpwYXNz')).toBe(true);
    });

    it('should return false for raw token', () => {
      expect(isBasicAuth('dXNlcjpwYXNz')).toBe(false);
    });

    it('should return false for Bearer token', () => {
      expect(isBasicAuth('Bearer eyJhbGciOiJIUzI1NiIs')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isBasicAuth('')).toBe(false);
    });

    it('should return false for Basic without space', () => {
      expect(isBasicAuth('BasicdXNlcjpwYXNz')).toBe(false);
    });

    // RFC 7617 §2.1: the auth scheme is case-insensitive, so lowercase/uppercase
    // "basic" prefixes are valid. (Previously this asserted case-sensitivity,
    // which BUG-2026-009 identified as incorrect — a server returning
    // "basic dXNlcjpwYXNz" was mis-handled as a raw token.)
    it('should accept case-insensitive scheme per RFC 7617', () => {
      expect(isBasicAuth('basic dXNlcjpwYXNz')).toBe(true);
      expect(isBasicAuth('BASIC dXNlcjpwYXNz')).toBe(true);
    });
  });
});
