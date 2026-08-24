/**
 * Tests for jmapClient.logout() (BUG-2026-058)
 *
 * The `_loggingOut` latch was set but NEVER reset: if window.location.replace()
 * failed or was blocked (embedded webview, beforeunload handler), every later
 * logout() call silently returned while session/auth data remained. After the
 * fix the latch resets once cleanup completes, so a blocked navigation can
 * retry logout. Also verifies cleanup ordering and auth clearing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const replaceMock = vi.fn();
const disconnectWs = vi.fn();
const disconnectEs = vi.fn();
const clearAll = vi.fn();
const clearCsrfToken = vi.fn();

vi.mock('../eventSource', () => ({
  eventSourceManager: { disconnect: (...args: unknown[]) => disconnectEs(...(args as [])) },
}));

vi.mock('../websocket', () => ({
  webSocketManager: { disconnect: (...args: unknown[]) => disconnectWs(...(args as [])) },
}));

vi.mock('../stateManager', () => ({
  stateManager: {
    clearAll: (...args: unknown[]) => clearAll(...(args as [])),
    getState: vi.fn(),
    setState: vi.fn(),
  },
}));

vi.mock('../../utils/csrf', () => ({
  getCsrfToken: vi.fn(),
  getCsrfHeaderName: vi.fn(() => 'x-csrf-token'),
  clearCsrfToken: (...args: unknown[]) => clearCsrfToken(...(args as [])),
  regenerateCsrfToken: vi.fn(),
}));

import { jmapClient } from '../jmap';

describe('jmapClient.logout (BUG-2026-058)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    replaceMock.mockClear();
    disconnectWs.mockClear();
    disconnectEs.mockClear();
    clearAll.mockClear();
    clearCsrfToken.mockClear();

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: Object.assign(Object.create(Object.getPrototypeOf(originalLocation)), {
        ...originalLocation,
        replace: replaceMock,
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  function seedAuthState() {
    // Simulate an authenticated client before logging out.
    sessionStorage.setItem('jmap_auth', 'Basic xxx');
    sessionStorage.setItem('jmap_session', '{"accounts":{}}');
    (jmapClient as unknown as { session: unknown }).session = { accounts: {} };
    (jmapClient as unknown as { authHeader: unknown }).authHeader = 'Basic xxx';
  }

  it('performs full cleanup then redirects to /', () => {
    seedAuthState();

    jmapClient.logout();

    expect(disconnectWs).toHaveBeenCalledTimes(1);
    expect(disconnectEs).toHaveBeenCalledTimes(1);
    expect(clearAll).toHaveBeenCalledTimes(1);
    expect(clearCsrfToken).toHaveBeenCalledTimes(1);
    expect((jmapClient as unknown as { session: unknown }).session).toBeNull();
    expect((jmapClient as unknown as { authHeader: unknown }).authHeader).toBeNull();
    expect(sessionStorage.getItem('jmap_auth')).toBeNull();
    expect(sessionStorage.getItem('jmap_session')).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('resets the latch so a retry after a failed/blocked navigation works again', () => {
    // First attempt: navigation fails/throws.
    replaceMock.mockImplementationOnce(() => {
      throw new Error('navigation blocked');
    });

    expect(() => jmapClient.logout()).toThrow('navigation blocked');

    // Second attempt must NOT be swallowed by the latch — cleanup runs again.
    jmapClient.logout();

    expect(disconnectWs).toHaveBeenCalledTimes(2);
    expect(clearAll).toHaveBeenCalledTimes(2);
    expect(replaceMock).toHaveBeenCalledTimes(2);
  });
});
