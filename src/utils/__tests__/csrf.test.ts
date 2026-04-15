import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCsrfToken,
  getCsrfHeaderName,
  createCsrfHeaders,
  clearCsrfToken,
  regenerateCsrfToken,
} from '../csrf';

describe('csrf', () => {
  beforeEach(() => {
    // Clear CSRF token before each test
    clearCsrfToken();
  });

  describe('getCsrfToken', () => {
    it('should generate a token when none exists', () => {
      const token = getCsrfToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should return the same token on subsequent calls', () => {
      const token1 = getCsrfToken();
      const token2 = getCsrfToken();
      expect(token1).toBe(token2);
    });

    it('should generate a new token after regeneration', () => {
      const token1 = getCsrfToken();
      const token2 = regenerateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('getCsrfHeaderName', () => {
    it('should return X-CSRF-Token', () => {
      expect(getCsrfHeaderName()).toBe('X-CSRF-Token');
    });
  });

  describe('createCsrfHeaders', () => {
    it('should include CSRF token in headers', () => {
      const headers = createCsrfHeaders();
      expect(headers['X-CSRF-Token']).toBeDefined();
      expect(headers['X-CSRF-Token'].length).toBe(64);
    });

    it('should merge with existing headers', () => {
      const headers = createCsrfHeaders({ 'Content-Type': 'application/json' });
      expect(headers['X-CSRF-Token']).toBeDefined();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('clearCsrfToken', () => {
    it('should clear the token', () => {
      const token1 = getCsrfToken();
      clearCsrfToken();
      const token2 = getCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });
});
