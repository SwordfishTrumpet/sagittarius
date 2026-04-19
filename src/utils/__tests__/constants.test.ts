import { describe, it, expect } from 'vitest';
import {
  STALE_TIME,
  AUTO_SAVE,
  CLEANUP,
  ANIMATION,
  NETWORK,
  DEBOUNCE,
} from '../constants';

describe('constants', () => {
  describe('STALE_TIME', () => {
    it('should have correct mailbox stale time (5 minutes)', () => {
      expect(STALE_TIME.mailboxes).toBe(5 * 60 * 1000);
    });

    it('should have correct quota stale time (15 minutes)', () => {
      expect(STALE_TIME.quota).toBe(15 * 60 * 1000);
    });

    it('should have correct identities stale time (30 minutes)', () => {
      expect(STALE_TIME.identities).toBe(30 * 60 * 1000);
    });

    it('should be readonly (TypeScript const assertion)', () => {
      // This test verifies the structure exists at runtime
      expect(Object.keys(STALE_TIME)).toContain('mailboxes');
      expect(Object.keys(STALE_TIME)).toContain('quota');
      expect(Object.keys(STALE_TIME)).toContain('identities');
    });
  });

  describe('AUTO_SAVE', () => {
    it('should have correct draft debounce time (2 seconds)', () => {
      expect(AUTO_SAVE.draftDebounce).toBe(2000);
    });

    it('should have correct draft persist interval (30 seconds)', () => {
      expect(AUTO_SAVE.draftPersistInterval).toBe(30000);
    });
  });

  describe('CLEANUP', () => {
    it('should have correct object URL revoke time (1 minute)', () => {
      expect(CLEANUP.objectUrlRevoke).toBe(60000);
    });

    it('should have correct toast duration (4 seconds)', () => {
      expect(CLEANUP.toastDuration).toBe(4000);
    });

    it('should have correct tooltip delay (300ms)', () => {
      expect(CLEANUP.tooltipDelay).toBe(300);
    });
  });

  describe('ANIMATION', () => {
    it('should have correct fast animation duration (150ms)', () => {
      expect(ANIMATION.fast).toBe(150);
    });

    it('should have correct normal animation duration (200ms)', () => {
      expect(ANIMATION.normal).toBe(200);
    });

    it('should have correct slow animation duration (300ms)', () => {
      expect(ANIMATION.slow).toBe(300);
    });

    it('should have correct list item animation duration (250ms)', () => {
      expect(ANIMATION.listItem).toBe(250);
    });
  });

  describe('NETWORK', () => {
    it('should have correct request timeout (30 seconds)', () => {
      expect(NETWORK.requestTimeout).toBe(30000);
    });

    it('should have correct reconnect delay (3 seconds)', () => {
      expect(NETWORK.reconnectDelay).toBe(3000);
    });

    it('should have correct max reconnect attempts (5)', () => {
      expect(NETWORK.maxReconnectAttempts).toBe(5);
    });
  });

  describe('DEBOUNCE', () => {
    it('should have correct search debounce (300ms)', () => {
      expect(DEBOUNCE.search).toBe(300);
    });

    it('should have correct resize debounce (100ms)', () => {
      expect(DEBOUNCE.resize).toBe(100);
    });

    it('should have correct scroll debounce (50ms)', () => {
      expect(DEBOUNCE.scroll).toBe(50);
    });
  });

  describe('constants structure', () => {
    it('should export all constant groups', () => {
      expect(STALE_TIME).toBeDefined();
      expect(AUTO_SAVE).toBeDefined();
      expect(CLEANUP).toBeDefined();
      expect(ANIMATION).toBeDefined();
      expect(NETWORK).toBeDefined();
      expect(DEBOUNCE).toBeDefined();
    });

    it('should have positive values for all timeouts', () => {
      expect(Object.values(STALE_TIME).every(v => v > 0)).toBe(true);
      expect(Object.values(AUTO_SAVE).every(v => v > 0)).toBe(true);
      expect(Object.values(CLEANUP).every(v => v > 0)).toBe(true);
      expect(Object.values(ANIMATION).every(v => v > 0)).toBe(true);
      expect(Object.values(NETWORK).every(v => v > 0)).toBe(true);
      expect(Object.values(DEBOUNCE).every(v => v > 0)).toBe(true);
    });
  });
});
