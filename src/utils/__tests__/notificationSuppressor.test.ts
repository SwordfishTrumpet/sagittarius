import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createNotificationSuppressor,
  sharedNotificationSuppressor,
} from '../notificationSuppressor';

describe('notificationSuppressor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createNotificationSuppressor', () => {
    it('should create suppressor with default suppress duration', () => {
      const suppressor = createNotificationSuppressor();
      expect(suppressor.getLastMutationTime()).toBe(0);
      expect(suppressor.shouldSuppress()).toBe(false);
    });

    it('should create suppressor with custom suppress duration', () => {
      const suppressor = createNotificationSuppressor(5000);
      suppressor.suppress();
      expect(suppressor.shouldSuppress(5000)).toBe(true);
    });

    it('should suppress notifications after calling suppress', () => {
      const suppressor = createNotificationSuppressor(3000);
      expect(suppressor.shouldSuppress()).toBe(false);
      suppressor.suppress();
      expect(suppressor.shouldSuppress()).toBe(true);
    });

    it('should record last mutation time when suppressing', () => {
      const suppressor = createNotificationSuppressor();
      const beforeSuppress = Date.now();
      suppressor.suppress();
      const afterSuppress = Date.now();
      expect(suppressor.getLastMutationTime()).toBeGreaterThanOrEqual(beforeSuppress);
      expect(suppressor.getLastMutationTime()).toBeLessThanOrEqual(afterSuppress);
    });

    it('should stop suppressing after duration expires', () => {
      const suppressor = createNotificationSuppressor(3000);
      suppressor.suppress();
      expect(suppressor.shouldSuppress()).toBe(true);
      vi.advanceTimersByTime(3001);
      expect(suppressor.shouldSuppress()).toBe(false);
    });

    it('should support custom override duration', () => {
      const suppressor = createNotificationSuppressor(10000);
      suppressor.suppress();
      expect(suppressor.shouldSuppress(5000)).toBe(true);
      vi.advanceTimersByTime(5001);
      expect(suppressor.shouldSuppress(5000)).toBe(false);
      // Default duration still applies
      expect(suppressor.shouldSuppress()).toBe(true);
    });

    it('should update last mutation time on subsequent suppress calls', () => {
      const suppressor = createNotificationSuppressor();
      suppressor.suppress();
      const firstTime = suppressor.getLastMutationTime();
      vi.advanceTimersByTime(100);
      suppressor.suppress();
      const secondTime = suppressor.getLastMutationTime();
      expect(secondTime).toBeGreaterThan(firstTime);
    });

    it('should extend suppression period with new suppress call', () => {
      const suppressor = createNotificationSuppressor(3000);
      suppressor.suppress();
      vi.advanceTimersByTime(2500);
      expect(suppressor.shouldSuppress()).toBe(true);
      suppressor.suppress(); // Reset the timer
      vi.advanceTimersByTime(2500);
      expect(suppressor.shouldSuppress()).toBe(true); // Still suppressed
    });
  });

  describe('sharedNotificationSuppressor', () => {
    it('should be a singleton instance', () => {
      expect(sharedNotificationSuppressor).toBeDefined();
      expect(typeof sharedNotificationSuppressor.suppress).toBe('function');
      expect(typeof sharedNotificationSuppressor.shouldSuppress).toBe('function');
      expect(typeof sharedNotificationSuppressor.getLastMutationTime).toBe('function');
    });

    it('should have default 3000ms suppression window', () => {
      sharedNotificationSuppressor.suppress();
      expect(sharedNotificationSuppressor.shouldSuppress()).toBe(true);
      vi.advanceTimersByTime(3001);
      expect(sharedNotificationSuppressor.shouldSuppress()).toBe(false);
    });
  });
});
