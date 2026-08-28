import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AuthError,
  ServerUnreachableError,
  JMAPProtocolError,
  isAuthError,
  isServerUnreachableError,
  isJMAPProtocolError,
  classifyJMAPError,
} from '../jmapErrors';

describe('jmapErrors taxonomy', () => {
  describe('error classes', () => {
    it('carries the kind marker on each class', () => {
      expect(new AuthError('x').kind).toBe('auth');
      expect(new AuthError('x').retryable).toBe(false);
      expect(new ServerUnreachableError('x').kind).toBe('server-unreachable');
      expect(new ServerUnreachableError('x').retryable).toBe(true);
      expect(new JMAPProtocolError('x').kind).toBe('protocol');
      expect(new JMAPProtocolError('x', 500).status).toBe(500);
      expect(new JMAPProtocolError('x').status).toBeNull();
    });

    it('extends Error so existing error handling keeps working', () => {
      expect(new AuthError('Authentication failed')).toBeInstanceOf(Error);
      expect(new ServerUnreachableError('Server unreachable')).toBeInstanceOf(Error);
    });
  });

  describe('kind predicates', () => {
    it('detects errors by kind marker without relying on instanceof', () => {
      const foreignCopy = { kind: 'server-unreachable', message: 'x' };
      expect(isServerUnreachableError(foreignCopy)).toBe(true);
      expect(isServerUnreachableError(new Error('x'))).toBe(false);
      expect(isAuthError({ kind: 'auth' })).toBe(true);
      expect(isJMAPProtocolError({ kind: 'protocol' })).toBe(true);
      expect(isServerUnreachableError(null)).toBe(false);
      expect(isServerUnreachableError('string')).toBe(false);
    });

    it('recognizes real instances', () => {
      expect(isAuthError(new AuthError('x'))).toBe(true);
      expect(isServerUnreachableError(new ServerUnreachableError('x'))).toBe(true);
      expect(isJMAPProtocolError(new JMAPProtocolError('x'))).toBe(true);
    });
  });

  describe('classifyJMAPError', () => {
    it('classifies by HTTP status', () => {
      expect(classifyJMAPError(new Error('x'), 401)).toBe('auth');
      expect(classifyJMAPError(new Error('x'), 403)).toBe('auth');
      expect(classifyJMAPError(new Error('x'), 502)).toBe('server-unreachable');
      expect(classifyJMAPError(new Error('x'), 503)).toBe('server-unreachable');
      expect(classifyJMAPError(new Error('x'), 504)).toBe('server-unreachable');
      expect(classifyJMAPError(new Error('x'), 500)).toBe('protocol');
      expect(classifyJMAPError(new Error('x'), 200)).toBe('protocol');
    });

    it('prefers the embedded kind over the status', () => {
      expect(classifyJMAPError(new ServerUnreachableError('x'), 401)).toBe('server-unreachable');
      expect(classifyJMAPError(new AuthError('x'), 502)).toBe('auth');
    });

    it('defaults unknown errors to protocol', () => {
      expect(classifyJMAPError(new Error('boom'))).toBe('protocol');
      expect(classifyJMAPError('boom')).toBe('protocol');
    });
  });
});
