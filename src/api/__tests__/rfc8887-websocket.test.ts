/**
 * RFC 8887 (JMAP over WebSocket) Compliance Tests
 *
 * Tests the WebSocketManager's adherence to RFC 8887:
 * - Section 3: WebSocket Connection (subprotocol, handshake)
 * - Section 4.1: Sending Requests
 * - Section 4.2: Receiving Responses
 * - Section 4.3: Receiving Push StateChange notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the WebSocketManager by directly importing and calling its methods
// with a mocked WebSocket.

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number;
  url: string;
  protocol: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  sentMessages: string[] = [];
  private _protocols: string[];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this._protocols = Array.isArray(protocols) ? protocols : protocols ? [protocols] : [];
    this.protocol = this._protocols[0] || '';

    // Auto-open after a microtask (simulates real WebSocket behavior)
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({} as Event);
    });
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helper: simulate receiving a message
  _receiveMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

// Provide sessionStorage mock
const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
  get length() { return Object.keys(mockSessionStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
};

describe('RFC 8887 — JMAP over WebSocket', () => {
  let capturedWs: MockWebSocket | null = null;
  let mockQueryClient: any;

  beforeEach(() => {
    vi.resetModules();
    capturedWs = null;
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
    vi.stubGlobal('WebSocket', class extends MockWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        capturedWs = this;
      }
    });

    // Mock QueryClient
    mockQueryClient = {
      invalidateQueries: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // §3 — Connection
  // =========================================================================
  describe('§3 — WebSocket Connection', () => {
    it('should use "jmap" subprotocol per RFC 8887 §3', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'ignored', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs).not.toBeNull());

      // RFC 8887 §3: The client MUST use "jmap" as the WebSocket subprotocol
      expect(capturedWs!.protocol).toBe('jmap');

      webSocketManager.disconnect();
    });

    it('should report connection state accurately', async () => {
      const { webSocketManager } = await import('../websocket');

      expect(webSocketManager.isConnected()).toBe(false);

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      // Wait for mock WebSocket to open
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      expect(webSocketManager.isConnected()).toBe(true);

      webSocketManager.disconnect();
      expect(webSocketManager.isConnected()).toBe(false);
    });
  });

  // =========================================================================
  // §4.1 — Sending Requests
  // =========================================================================
  describe('§4.1 — Sending Requests', () => {
    it('should add @type: "Request" to outgoing messages (§4.1)', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      // Start a request (don't await — we'll inspect the sent message)
      const requestPromise = webSocketManager.request({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        methodCalls: [['Mailbox/get', { accountId: 'a1', ids: null }, '0']],
      });

      // Check the sent WebSocket message
      expect(capturedWs!.sentMessages.length).toBe(1);
      const sent = JSON.parse(capturedWs!.sentMessages[0]);

      // RFC 8887 §4.1: Request objects sent over WebSocket MUST have "@type": "Request"
      expect(sent['@type']).toBe('Request');
      // Must have a requestId
      expect(sent.requestId).toBeDefined();
      expect(typeof sent.requestId).toBe('string');
      // Must pass through using and methodCalls
      expect(sent.using).toContain('urn:ietf:params:jmap:core');
      expect(Array.isArray(sent.methodCalls)).toBe(true);

      // Resolve the pending request to avoid timeout
      capturedWs!._receiveMessage({
        requestId: sent.requestId,
        methodResponses: [['Mailbox/get', { list: [] }, '0']],
        sessionState: 's1',
      });
      await requestPromise;

      webSocketManager.disconnect();
    });

    it('should use crypto.randomUUID() for unique requestId (§4.1)', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      // Send two requests
      const req1 = webSocketManager.request({
        using: ['urn:ietf:params:jmap:core'],
        methodCalls: [['Mailbox/get', { accountId: 'a1', ids: null }, '0']],
      });
      const req2 = webSocketManager.request({
        using: ['urn:ietf:params:jmap:core'],
        methodCalls: [['Email/get', { accountId: 'a1', ids: ['e1'] }, '0']],
      });

      const id1 = JSON.parse(capturedWs!.sentMessages[0]).requestId;
      const id2 = JSON.parse(capturedWs!.sentMessages[1]).requestId;

      // Each request must have a unique ID
      expect(id1).not.toBe(id2);

      // Resolve both
      capturedWs!._receiveMessage({ requestId: id1, methodResponses: [['Mailbox/get', { list: [] }, '0']], sessionState: 's1' });
      capturedWs!._receiveMessage({ requestId: id2, methodResponses: [['Email/get', { list: [] }, '0']], sessionState: 's1' });
      await Promise.all([req1, req2]);

      webSocketManager.disconnect();
    });

    it('should reject if WebSocket is not connected', async () => {
      const { webSocketManager } = await import('../websocket');

      // Not connected — request should fail
      await expect(
        webSocketManager.request({ using: [], methodCalls: [] }),
      ).rejects.toThrow(/not connected/i);
    });
  });

  // =========================================================================
  // §4.2 — Receiving Responses
  // =========================================================================
  describe('§4.2 — Receiving Responses', () => {
    it('should route response by requestId to correct pending request (§4.2)', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      const promise = webSocketManager.request({
        using: ['urn:ietf:params:jmap:core'],
        methodCalls: [['Mailbox/get', { accountId: 'a1', ids: null }, '0']],
      });

      const requestId = JSON.parse(capturedWs!.sentMessages[0]).requestId;

      // Simulate server response with matching requestId
      capturedWs!._receiveMessage({
        requestId,
        methodResponses: [['Mailbox/get', { list: [{ id: 'mb1', name: 'Inbox' }] }, '0']],
        sessionState: 's2',
      });

      const response = await promise;

      // RFC 8887 §4.2: Response object is a standard JMAP Response
      expect(response.methodResponses).toBeDefined();
      expect(response.methodResponses[0][0]).toBe('Mailbox/get');
      expect(response.sessionState).toBe('s2');

      webSocketManager.disconnect();
    });
  });

  // =========================================================================
  // §4.3 — Push Notifications (StateChange)
  // =========================================================================
  describe('§4.3 — Push Notifications (StateChange)', () => {
    it('should handle StateChange push with @type: "StateChange" (§4.3)', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      // Simulate StateChange push from server
      capturedWs!._receiveMessage({
        '@type': 'StateChange',
        changed: {
          'account-001': {
            Email: 'state-new-email',
            Mailbox: 'state-new-mailbox',
          },
        },
      });

      // Should invalidate the relevant query caches
      await vi.waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
      });

      webSocketManager.disconnect();
    });

    it('should invalidate Email queries on Email state change', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      capturedWs!._receiveMessage({
        '@type': 'StateChange',
        changed: { 'a1': { Email: 'new-state' } },
      });

      await vi.waitFor(() => {
        const calls = mockQueryClient.invalidateQueries.mock.calls;
        const keys = calls.map((c: any[]) => c[0].queryKey[0]);
        expect(keys).toContain('threads');
        expect(keys).toContain('emails');
        expect(keys).toContain('emailDetail');
      });

      webSocketManager.disconnect();
    });

    it('should invalidate Mailbox queries on Mailbox state change', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      capturedWs!._receiveMessage({
        '@type': 'StateChange',
        changed: { 'a1': { Mailbox: 'new-mailbox-state' } },
      });

      await vi.waitFor(() => {
        const calls = mockQueryClient.invalidateQueries.mock.calls;
        const keys = calls.map((c: any[]) => c[0].queryKey[0]);
        expect(keys).toContain('mailboxes');
      });

      webSocketManager.disconnect();
    });

    it('should not fire new-mail listeners when mutation was local', async () => {
      const { webSocketManager } = await import('../websocket');
      const listener = vi.fn();

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      webSocketManager.onNewMail(listener);

      // Suppress notifications (as if we just did a local mutation)
      webSocketManager.suppressNotification();

      // Simulate Email state change
      capturedWs!._receiveMessage({
        '@type': 'StateChange',
        changed: { 'a1': { Email: 'new-email-state' } },
      });

      // Should NOT fire because we just suppressed
      await new Promise((r) => setTimeout(r, 50));
      expect(listener).not.toHaveBeenCalled();

      webSocketManager.disconnect();
    });

    it('should always fire new-mail listeners for EmailDelivery state change', async () => {
      const { webSocketManager } = await import('../websocket');
      const listener = vi.fn();

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      webSocketManager.onNewMail(listener);

      capturedWs!._receiveMessage({
        '@type': 'StateChange',
        changed: { 'a1': { EmailDelivery: 'delivery-state-1' } },
      });

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      webSocketManager.disconnect();
    });

    it('should skip StateChange when state has not actually changed', async () => {
      const { webSocketManager } = await import('../websocket');
      const { stateManager } = await import('../stateManager');

      // Pre-set the state so it matches the "new" state
      stateManager.setState('Email', 'same-state');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      capturedWs!._receiveMessage({
        '@type': 'StateChange',
        changed: { 'a1': { Email: 'same-state' } },
      });

      // Should NOT invalidate anything — no change
      await new Promise((r) => setTimeout(r, 50));
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();

      stateManager.clearAll();
      webSocketManager.disconnect();
    });
  });

  // =========================================================================
  // Disconnect / Cleanup
  // =========================================================================
  describe('Disconnect & Cleanup', () => {
    it('should reject pending requests on disconnect', async () => {
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      const promise = webSocketManager.request({
        using: ['urn:ietf:params:jmap:core'],
        methodCalls: [['Mailbox/get', { accountId: 'a1', ids: null }, '0']],
      });

      // Disconnect while request is in-flight
      webSocketManager.disconnect();

      await expect(promise).rejects.toThrow(/closed/i);
    });

    it('should unsubscribe new-mail listeners', async () => {
      const { webSocketManager } = await import('../websocket');
      const listener = vi.fn();

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      const unsub = webSocketManager.onNewMail(listener);
      unsub(); // Unsubscribe

      capturedWs!._receiveMessage({
        '@type': 'StateChange',
        changed: { 'a1': { EmailDelivery: 'new-delivery' } },
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(listener).not.toHaveBeenCalled();

      webSocketManager.disconnect();
    });
  });

  // =========================================================================
  // Reconnection Behavior
  // =========================================================================
  describe('Reconnection Behavior', () => {
    it('should reconnect after connection closes with non-1000 code', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      const firstWs = capturedWs;
      expect(firstWs).not.toBeNull();

      // Simulate connection close with error code (not clean close 1000)
      firstWs!.onclose?.({
        code: 1006, // Abnormal closure
        reason: 'Connection lost',
        wasClean: false,
      } as CloseEvent);

      // Should not be connected anymore
      expect(webSocketManager.isConnected()).toBe(false);

      // Advance timers to trigger reconnection (1000ms base delay)
      await vi.advanceTimersByTimeAsync(1000);

      // A new WebSocket should have been created
      expect(capturedWs).not.toBe(firstWs);
      expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN);
      expect(webSocketManager.isConnected()).toBe(true);

      webSocketManager.disconnect();
      vi.useRealTimers();
    });

    it('should use exponential backoff for reconnection attempts', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { createReconnectionStrategy } = await import('../../utils/reconnectionStrategy');
      
      // Create a strategy to verify backoff timing
      const strategy = createReconnectionStrategy({
        baseDelayMs: 1000,
        maxDelayMs: 60000,
      });

      // First delay should be 1000ms
      const firstDelay = strategy.nextDelay();
      expect(firstDelay).toBe(1000);
      expect(strategy.attempts).toBe(1);

      // Second delay should be 2000ms (doubled)
      const secondDelay = strategy.nextDelay();
      expect(secondDelay).toBe(2000);
      expect(strategy.attempts).toBe(2);

      // Third delay should be 4000ms
      const thirdDelay = strategy.nextDelay();
      expect(thirdDelay).toBe(4000);
      expect(strategy.attempts).toBe(3);

      // Reset should return to initial state
      strategy.reset();
      expect(strategy.attempts).toBe(0);
      const resetDelay = strategy.nextDelay();
      expect(resetDelay).toBe(1000);

      vi.useRealTimers();
    });

    it('should NOT reconnect after clean close (code 1000)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { webSocketManager } = await import('../websocket');

      webSocketManager.connect('wss://mail.example.com/jmap/ws', 'jmap', mockQueryClient);
      await vi.waitFor(() => expect(capturedWs?.readyState).toBe(MockWebSocket.OPEN));

      const firstWs = capturedWs;

      // Simulate clean close (code 1000 = normal closure)
      firstWs!.onclose?.({
        code: 1000,
        reason: 'Normal closure',
        wasClean: true,
      } as CloseEvent);

      // Should not reconnect after clean close
      await vi.advanceTimersByTimeAsync(5000);

      // No new WebSocket should have been created
      expect(capturedWs).toBe(firstWs);
      expect(webSocketManager.isConnected()).toBe(false);

      vi.useRealTimers();
    });

    it('should reset backoff after successful connection', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { createReconnectionStrategy } = await import('../../utils/reconnectionStrategy');
      
      const strategy = createReconnectionStrategy({
        baseDelayMs: 1000,
        maxDelayMs: 60000,
      });

      // First delay
      expect(strategy.nextDelay()).toBe(1000);
      expect(strategy.attempts).toBe(1);

      // Second delay (doubled)
      expect(strategy.nextDelay()).toBe(2000);
      expect(strategy.attempts).toBe(2);

      // Reset on successful connection
      strategy.reset();
      expect(strategy.attempts).toBe(0);

      // After reset, should start at base delay again
      expect(strategy.nextDelay()).toBe(1000);
      expect(strategy.attempts).toBe(1);

      vi.useRealTimers();
    });
  });
});
