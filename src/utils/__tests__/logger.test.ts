import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, redactUrl } from '../logger';

describe('logger', () => {
  const originalConsole = { ...console };
  const consoleMocks = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal('console', consoleMocks);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('logger methods', () => {
    it('should call console.log with prefix in dev mode', () => {
      // DEV is true in test environment
      logger.debug('test message');
      expect(consoleMocks.log).toHaveBeenCalledWith('[Sagittarius]', 'test message');
    });

    it('should call console.info with prefix', () => {
      logger.info('info message');
      expect(consoleMocks.info).toHaveBeenCalledWith('[Sagittarius]', 'info message');
    });

    it('should call console.warn with prefix', () => {
      logger.warn('warning message');
      expect(consoleMocks.warn).toHaveBeenCalledWith('[Sagittarius]', 'warning message');
    });

    it('should always call console.error regardless of dev mode', () => {
      logger.error('error message');
      expect(consoleMocks.error).toHaveBeenCalledWith('[Sagittarius]', 'error message');
    });

    it('should handle multiple arguments', () => {
      logger.debug('arg1', 'arg2', 123);
      expect(consoleMocks.log).toHaveBeenCalledWith('[Sagittarius]', 'arg1', 'arg2', 123);
    });

    it('should handle object arguments', () => {
      const obj = { key: 'value' };
      logger.debug('data:', obj);
      expect(consoleMocks.log).toHaveBeenCalledWith('[Sagittarius]', 'data:', obj);
    });
  });

  describe('redactUrl', () => {
    it('should redact access_token from URL', () => {
      const url = 'https://example.com/api?access_token=secret123&other=value';
      const result = redactUrl(url);
      expect(result).not.toContain('secret123');
      expect(result).toMatch(/access_token=.*REDACTED/);
    });

    it('should return unchanged URL without access_token', () => {
      const url = 'https://example.com/api?other=value';
      const result = redactUrl(url);
      expect(result).toBe(url);
    });

    it('should handle URL with only access_token', () => {
      const url = 'https://example.com/api?access_token=secret';
      const result = redactUrl(url);
      expect(result).toMatch(/access_token=.*REDACTED/);
      expect(result).not.toContain('secret');
    });

    it('should handle URL without query params', () => {
      const url = 'https://example.com/api';
      const result = redactUrl(url);
      expect(result).toBe(url);
    });

    it('should handle relative URLs', () => {
      const url = '/api?access_token=secret123';
      const result = redactUrl(url);
      expect(result).not.toContain('secret123');
      expect(result).toMatch(/access_token=.*REDACTED/);
    });

    it('should handle malformed URLs gracefully', () => {
      const url = 'not-a-valid-url?access_token=secret';
      const result = redactUrl(url);
      expect(result).toMatch(/REDACTED/);
      expect(result).not.toContain('secret');
    });

    it('should handle empty string', () => {
      const result = redactUrl('');
      // URL API resolves empty string to current origin
      expect(result).toBeDefined();
    });

    it('should handle URLs with hash fragments', () => {
      const url = 'https://example.com/api?access_token=secret#section';
      const result = redactUrl(url);
      expect(result).not.toContain('secret');
    });

    it('should handle multiple access_token params (edge case)', () => {
      const url = 'https://example.com/api?access_token=first&access_token=second';
      const result = redactUrl(url);
      // URL API only keeps last value, regex approach redacts all
      expect(result).not.toContain('first');
      expect(result).not.toContain('second');
    });
  });
});
