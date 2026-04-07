import type { QueryClient } from '@tanstack/react-query';
import type { JMAPResponse } from './jmap';
import type { JMAPStateChange } from '../types/jmap';
import { stateManager } from './stateManager';
import { logger, redactUrl } from '../utils/logger';
import { createReconnectionStrategy, RECONNECTION_DEFAULTS } from '../utils/reconnectionStrategy';
import { createStateChangeHandler, type NewMailListener } from '../utils/stateChangeHandler';
import { sharedNotificationSuppressor } from '../utils/notificationSuppressor';

type PendingRequest = {
  resolve: (v: JMAPResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const JMAP_SUBPROTOCOL = 'jmap';
const REQUEST_TIMEOUT_MS = 30_000;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private queryClient: QueryClient | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string | null = null;
  private _destroyed = false;
  private _connected = false;
  private newMailListeners: Set<NewMailListener> = new Set();
  private connectionStateListeners: Set<(connected: boolean) => void> = new Set();

  private reconnectionStrategy = createReconnectionStrategy({
    baseDelayMs: RECONNECTION_DEFAULTS.BASE_BACKOFF_MS,
    maxDelayMs: RECONNECTION_DEFAULTS.MAX_BACKOFF_MS,
  });

  private stateChangeHandler = createStateChangeHandler(null, { logPrefix: '[JMAP WebSocket]' });

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Open a JMAP WebSocket connection.
   *
   * @param url        The `ws://` / `wss://` endpoint (already resolved/relative).
   * @param subprotocol  Ignored — always uses `"jmap"` per RFC 8887. Kept for
   *                     call-site compatibility with the EventSource counterpart.
   * @param queryClient  TanStack QueryClient used to invalidate caches on push
   *                     notifications.
   */
  connect(url: string, _subprotocol: string, queryClient: QueryClient): void {
    this._destroyed = false;
    this.url = url;
    this.queryClient = queryClient;
    this.reconnectionStrategy.reset();
    // Update state change handler with the new queryClient
    this.stateChangeHandler = createStateChangeHandler(queryClient, { logPrefix: '[JMAP WebSocket]' });
    this._openConnection();
  }

  /**
   * Send a JMAP request over the WebSocket and await the corresponding response.
   * Rejects after REQUEST_TIMEOUT_MS milliseconds.
   *
   * `body` must be a valid JMAP Request object (i.e. already contains `using`
   * and `methodCalls`). The `@type` and `requestId` fields are injected here.
   */
  async request(body: Record<string, unknown>): Promise<JMAPResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('[JMAP WebSocket] Not connected — cannot send request');
    }

    const requestId = crypto.randomUUID();

    const envelope: Record<string, unknown> = {
      ...body,
      '@type': 'Request',
      requestId,
    };

    return new Promise<JMAPResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('[JMAP WebSocket] Request timed out'));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      try {
        this.ws!.send(JSON.stringify(envelope));
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Returns `true` when the socket is open and the handshake has completed. */
  isConnected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Register a callback that fires whenever an `EmailDelivery` state-change is
   * received (i.e. new mail arrived).  Returns an unsubscribe function.
   */
  onNewMail(listener: NewMailListener): () => void {
    this.newMailListeners.add(listener);
    return () => this.newMailListeners.delete(listener);
  }

  /**
   * Register a callback that fires whenever the connection state changes.
   * Returns an unsubscribe function.
   */
  onConnectionStateChange(listener: (connected: boolean) => void): () => void {
    this.connectionStateListeners.add(listener);
    return () => this.connectionStateListeners.delete(listener);
  }

  private notifyConnectionStateChange(connected: boolean): void {
    for (const listener of this.connectionStateListeners) {
      try {
        listener(connected);
      } catch (err) {
        logger.error('[JMAP WebSocket] Error in connection state listener:', err);
      }
    }
  }

  /**
   * Permanently close the connection and cancel all in-flight requests.
   * After calling `disconnect()` the instance will not attempt to reconnect
   * until `connect()` is called again.
   */
  disconnect(): void {
    this._destroyed = true;
    this._connected = false;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear pending requests on connection close to prevent Promise leaks
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('[JMAP WebSocket] Connection closed'));
      this.pendingRequests.delete(id);
    }

    if (this.ws) {
      // Remove the onclose handler so the scheduled-reconnect path is not
      // triggered after an intentional disconnect.
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    logger.debug('[JMAP WebSocket] Disconnected');
  }

  /**
   * Call this before performing a local Email mutation (delete, move, flag,
   * keyword update, etc.) so that the server's echo of our own change does
   * not trigger the new-mail notification sound.
   */
  suppressNotification(): void {
    sharedNotificationSuppressor.suppress();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _openConnection(): void {
    if (this._destroyed || !this.url) return;

    logger.debug('[JMAP WebSocket] Connecting to', redactUrl(this.url));

    try {
      this.ws = new WebSocket(this.url, [JMAP_SUBPROTOCOL]);
    } catch (err) {
      // WebSocket constructor can throw synchronously for bad URLs.
      logger.error('[JMAP WebSocket] Failed to construct WebSocket:', err);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectionStrategy.reset(); // reset exponential back-off
      logger.debug('[JMAP WebSocket] Connected');
      this.notifyConnectionStateChange(true);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this._handleMessage(event.data);
    };

    this.ws.onerror = (event: Event) => {
      // The browser suppresses the actual error details for security reasons;
      // the onclose handler that follows will trigger the reconnect.
      logger.error('[JMAP WebSocket] Socket error:', event);
    };

    this.ws.onclose = (event: CloseEvent) => {
      this._connected = false;
      this.notifyConnectionStateChange(false);
      const closeReason = `code=${event.code}, reason=${event.reason || '—'}, clean=${event.wasClean}`;
      if (!this._destroyed && event.code !== 1000) {
        logger.warn(`[JMAP WebSocket] Closed (${closeReason}). Will reconnect...`);
        this._scheduleReconnect();
      } else {
        logger.debug(`[JMAP WebSocket] Closed (${closeReason})`);
      }
    };
  }

  private _handleMessage(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      logger.error('[JMAP WebSocket] Failed to parse message:', err, raw);
      return;
    }

    if (typeof data === 'object' && data !== null && (data as Record<string, unknown>)['@type'] === 'StateChange') {
      // RFC 8887 §4.3 — push notification
      this._handleStateChange(data as JMAPStateChange);
      return;
    }

    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.requestId === 'string') {
      // Response to a request we sent (RFC 8887 §4.2)
      const pending = this.pendingRequests.get(dataRecord.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(dataRecord.requestId);
        
        // Check for JMAP error responses in methodResponses and reject if found
        const response = data as JMAPResponse;
        if (response.methodResponses) {
          const errorResponse = response.methodResponses.find(([method]) => method === 'error');
          if (errorResponse) {
            const errorData = errorResponse[1] as { type?: string; description?: string };
            pending.reject(new Error(`JMAP error: ${errorData.type || 'Unknown'} — ${errorData.description || 'No description'}`));
            return;
          }
        }
        
        pending.resolve(response);
      } else {
        logger.warn(
          '[JMAP WebSocket] Received response for unknown requestId:',
          dataRecord.requestId,
        );
      }
      return;
    }

    logger.warn('[JMAP WebSocket] Unrecognised message:', data);
  }

  /**
   * Handle a JMAP StateChange push notification.
   *
   * Shape (RFC 8887 §4.3):
   * ```json
   * {
   *   "@type": "StateChange",
   *   "changed": {
   *     "<accountId>": { "Email": "<newState>", "Mailbox": "<newState>", … }
   *   }
   * }
   * ```
   */
  private _handleStateChange(data: JMAPStateChange): void {
    if (!data.changed) return;
    
    // Use shared state change handler for consistency with EventSource
    this.stateChangeHandler.handleStateChange(data.changed, this.newMailListeners);
  }

  private _scheduleReconnect(): void {
    if (this._destroyed) return;

    const delay = this.reconnectionStrategy.nextDelay();
    logger.debug(
      `[JMAP WebSocket] Reconnecting in ${delay}ms…`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._openConnection();
    }, delay);
  }
}

export const webSocketManager = new WebSocketManager();
