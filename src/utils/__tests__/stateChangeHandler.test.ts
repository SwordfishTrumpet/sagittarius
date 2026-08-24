/**
 * Tests for src/utils/stateChangeHandler.ts
 *
 * Focus: BUG-2026-057 — EmailDelivery must invalidate the same query-key set
 * as Email ('threads', 'emails', 'emailDetail'). Some servers emit
 * EmailDelivery instead of Email for new arrivals; previously ['emails'] and
 * emailDetail caches stayed stale. Also covers suppression semantics for the
 * Email case and the always-notify semantics of EmailDelivery.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createStateChangeHandler } from '../stateChangeHandler';
import { sharedNotificationSuppressor } from '../notificationSuppressor';
import { stateManager } from '../../api/stateManager';

vi.mock('../../api/stateManager', () => ({
  stateManager: {
    getState: vi.fn(() => undefined),
    setState: vi.fn(),
  },
}));

vi.mock('./logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../notificationSuppressor', () => ({
  sharedNotificationSuppressor: {
    shouldSuppress: vi.fn(() => false),
  },
}));

function makeHandler() {
  const queryClient = new QueryClient();
  const invalidateSpy = invalidateSpyOf(queryClient);
  const listeners = new Set<() => void>();
  const handler = createStateChangeHandler(queryClient);
  return { handler, invalidateSpy, listeners };
}

function invalidatedKeys(spy: ReturnType<typeof invalidateSpyOf>) {
  return spy.mock.calls.map((call) => call[0]?.queryKey?.[0]);
}

function invalidateSpyOf(queryClient: QueryClient) {
  return vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as never);
}

describe('createStateChangeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sharedNotificationSuppressor.shouldSuppress).mockReturnValue(false);
  });

  it('EmailDelivery invalidates threads, emails AND emailDetail (BUG-2026-057)', () => {
    const { handler, invalidateSpy, listeners } = makeHandler();
    const listener = vi.fn();
    listeners.add(listener);

    handler.invalidateForType('EmailDelivery', listeners);

    expect(new Set(invalidatedKeys(invalidateSpy))).toEqual(
      new Set(['threads', 'emails', 'emailDetail']),
    );
  });

  it('Email invalidates threads, emails and emailDetail', () => {
    const { handler, invalidateSpy, listeners } = makeHandler();

    handler.invalidateForType('Email', listeners);

    expect(new Set(invalidatedKeys(invalidateSpy))).toEqual(
      new Set(['threads', 'emails', 'emailDetail']),
    );
  });

  it('Email fires new-mail listeners only when not suppressed by a recent local mutation', () => {
    const { handler, listeners } = makeHandler();
    const listener = vi.fn();
    listeners.add(listener);

    handler.invalidateForType('Email', listeners);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.mocked(sharedNotificationSuppressor.shouldSuppress).mockReturnValue(true);
    handler.invalidateForType('Email', listeners);
    expect(listener).toHaveBeenCalledTimes(1); // still once
  });

  it('EmailDelivery always fires new-mail listeners even when suppressed locally', () => {
    const { handler, listeners } = makeHandler();
    const listener = vi.fn();
    listeners.add(listener);

    vi.mocked(sharedNotificationSuppressor.shouldSuppress).mockReturnValue(true);
    handler.invalidateForType('EmailDelivery', listeners);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Mailbox invalidates mailboxes only; unknown types are ignored', () => {
    const { handler, invalidateSpy, listeners } = makeHandler();

    handler.invalidateForType('Mailbox', listeners);
    expect(invalidatedKeys(invalidateSpy)).toEqual(['mailboxes']);

    invalidateSpy.mockClear();
    handler.invalidateForType('SomethingElse', listeners);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('handleStateChange skips unchanged state strings and dispatches changed ones', () => {
    vi.mocked(stateManager.getState).mockReturnValue('same-state');

    const { handler, invalidateSpy, listeners } = makeHandler();
    handler.handleStateChange({ acc1: { Mailbox: 'same-state' } }, listeners);
    expect(invalidateSpy).not.toHaveBeenCalled();

    invalidateSpy.mockClear();
    vi.mocked(stateManager.getState).mockReturnValue(null);
    handler.handleStateChange({ acc1: { EmailDelivery: 'new-state' } }, listeners);
    expect(stateManager.setState).toHaveBeenCalledWith('EmailDelivery', 'new-state');
    expect(invalidatedKeys(invalidateSpy)).toEqual(['threads', 'emails', 'emailDetail']);
  });
});
