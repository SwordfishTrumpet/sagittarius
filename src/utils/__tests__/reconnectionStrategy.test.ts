import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createReconnectionStrategy,
  RECONNECTION_DEFAULTS,
} from '../reconnectionStrategy';

describe('reconnectionStrategy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('createReconnectionStrategy', () => {
    it('should create strategy with default options', () => {
      const strategy = createReconnectionStrategy();
      expect(strategy.attempts).toBe(0);
      expect(strategy.currentDelay).toBe(1000);
    });

    it('should create strategy with custom options', () => {
      const strategy = createReconnectionStrategy({
        baseDelayMs: 500,
        maxDelayMs: 30000,
        maxAttempts: 10,
      });
      expect(strategy.currentDelay).toBe(500);
    });

    it('should return base delay on first nextDelay call', () => {
      const strategy = createReconnectionStrategy({ baseDelayMs: 1000 });
      expect(strategy.nextDelay()).toBe(1000);
    });

    it('should double delay each call (exponential backoff)', () => {
      const strategy = createReconnectionStrategy({ baseDelayMs: 1000 });
      expect(strategy.nextDelay()).toBe(1000);
      expect(strategy.nextDelay()).toBe(2000);
      expect(strategy.nextDelay()).toBe(4000);
      expect(strategy.nextDelay()).toBe(8000);
    });

    it('should cap delay at maxDelayMs', () => {
      const strategy = createReconnectionStrategy({
        baseDelayMs: 1000,
        maxDelayMs: 5000,
      });
      expect(strategy.nextDelay()).toBe(1000);
      expect(strategy.nextDelay()).toBe(2000);
      expect(strategy.nextDelay()).toBe(4000);
      expect(strategy.nextDelay()).toBe(5000); // capped
      expect(strategy.nextDelay()).toBe(5000); // still capped
    });

    it('should increment attempts counter', () => {
      const strategy = createReconnectionStrategy();
      expect(strategy.attempts).toBe(0);
      strategy.nextDelay();
      expect(strategy.attempts).toBe(1);
      strategy.nextDelay();
      expect(strategy.attempts).toBe(2);
    });

    it('should reset to initial state', () => {
      const strategy = createReconnectionStrategy({ baseDelayMs: 1000 });
      strategy.nextDelay();
      strategy.nextDelay();
      strategy.nextDelay();
      expect(strategy.attempts).toBe(3);
      expect(strategy.currentDelay).toBe(8000);
      strategy.reset();
      expect(strategy.attempts).toBe(0);
      expect(strategy.currentDelay).toBe(1000);
    });

    it('should report max attempts reached', () => {
      const strategy = createReconnectionStrategy({ maxAttempts: 3 });
      expect(strategy.isMaxAttemptsReached()).toBe(false);
      strategy.nextDelay();
      expect(strategy.isMaxAttemptsReached()).toBe(false);
      strategy.nextDelay();
      expect(strategy.isMaxAttemptsReached()).toBe(false);
      strategy.nextDelay();
      expect(strategy.isMaxAttemptsReached()).toBe(true);
    });

    it('should not limit attempts when maxAttempts is Infinity', () => {
      const strategy = createReconnectionStrategy({ maxAttempts: Infinity });
      for (let i = 0; i < 100; i++) {
        strategy.nextDelay();
      }
      expect(strategy.isMaxAttemptsReached()).toBe(false);
    });
  });

  describe('RECONNECTION_DEFAULTS', () => {
    it('should export default constants', () => {
      expect(RECONNECTION_DEFAULTS.BASE_BACKOFF_MS).toBe(1000);
      expect(RECONNECTION_DEFAULTS.MAX_BACKOFF_MS).toBe(60000);
    });
  });
});
