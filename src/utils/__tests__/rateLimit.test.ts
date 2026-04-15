import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  getRateLimitStatus,
} from '../rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    // Clear rate limit state before each test
    resetRateLimit();
  });

  describe('checkRateLimit', () => {
    it('should return null when no attempts have been made', () => {
      expect(checkRateLimit()).toBeNull();
    });

    it('should return null after reset', () => {
      recordFailedAttempt();
      resetRateLimit();
      expect(checkRateLimit()).toBeNull();
    });
  });

  describe('recordFailedAttempt', () => {
    it('should return remaining attempts after recording failure', () => {
      expect(recordFailedAttempt()).toBe(4); // 5 max - 1 = 4 remaining
      expect(recordFailedAttempt()).toBe(3);
      expect(recordFailedAttempt()).toBe(2);
      expect(recordFailedAttempt()).toBe(1);
    });

    it('should return 0 when locked out', () => {
      // Record 5 failures to trigger lockout
      for (let i = 0; i < 4; i++) {
        recordFailedAttempt();
      }
      expect(recordFailedAttempt()).toBe(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return not locked with 5 remaining attempts initially', () => {
      const status = getRateLimitStatus();
      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(5);
      expect(status.lockoutSeconds).toBeNull();
    });

    it('should return locked status after max attempts', () => {
      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt();
      }

      const status = getRateLimitStatus();
      expect(status.isLocked).toBe(true);
      expect(status.remainingAttempts).toBe(0);
      expect(status.lockoutSeconds).toBeGreaterThan(0);
    });
  });
});
