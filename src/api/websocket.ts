import type { QueryClient } from '@tanstack/react-query';
import type { JMAPResponse } from './jmap';
import { stateManager } from './stateManager';
import { logger } from '../utils/logger';

type PendingRequest = {
  resolve: (v: JMAPResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type NewMailListener = () => void;

const JMAP_SUBPROTOCOL = 'jmap';
const REQUEST_TIMEOUT_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Duration (ms) after a local mutation during which we suppress new-mail
 * notifications.  The server echoes our own changes back as Email state
 * updates — this window prevents those from playing the notification sound.
 */
const LOCAL_MUTATION_SUPPRESS_MS = 3_000;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private queryClient: QueryClient | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = BASE_BACKOFF_MS;
  private url: string | null = null;
  private _destroyed = false;
  private _connected = false;
  private newMailListeners: Set<NewMailListener> = new Set();

  /**
   * Timestamp of the last local Email mutation (delete, move, flag, etc.).
   * While Date.now() − _lastLocalMutation < LOCAL_MUTATION_SUPPRESS_MS,
   * Email state changes will NOT fire new-mail listeners.
   */
  private _lastLocalMutation = 0;

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
    this.reconnectDelay = BASE_BACKOFF_MS;
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

    // Reject every pending request immediately.
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
    this._lastLocalMutation = Date.now();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _openConnection(): void {
    if (this._destroyed || !this.url) return;

    logger.debug('[JMAP WebSocket] Connecting to', this.url);

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
      this.reconnectDelay = BASE_BACKOFF_MS; // reset exponential back-off
      logger.debug('[JMAP WebSocket] Connected');
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
      logger.debug(
        `[JMAP WebSocket] Closed (code=${event.code}, reason=${event.reason || '—'})`,
      );
      this._scheduleReconnect();
    };
  }

  private _handleMessage(raw: string): void {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      logger.error('[JMAP WebSocket] Failed to parse message:', err, raw);
      return;
    }

    if (data['@type'] === 'StateChange') {
      // RFC 8887 §4.3 — push notification
      this._handleStateChange(data);
      return;
    }

    if (typeof data.requestId === 'string') {
      // Response to a request we sent (RFC 8887 §4.2)
      const pending = this.pendingRequests.get(data.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(data.requestId);
        pending.resolve(data as JMAPResponse);
      } else {
        logger.warn(
          '[JMAP WebSocket] Received response for unknown requestId:',
          data.requestId,
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
  private _handleStateChange(data: any): void {
    if (!this.queryClient || !data.changed) return;

    for (const accountId of Object.keys(data.changed)) {
      const typeMap: Record<string, string> = data.changed[accountId];

      for (const [type, newState] of Object.entries(typeMap)) {
        const oldState = stateManager.getState(type);

        if (oldState === newState) continue; // nothing actually changed

        logger.debug(
          `[JMAP WebSocket] State change (account=${accountId}): ${type} ${oldState} → ${newState}`,
        );
        stateManager.setState(type, newState);
        this._invalidateForType(type);
      }
    }
  }

  private _invalidateForType(type: string): void {
    const qc = this.queryClient;
    if (!qc) return;

    switch (type) {
      case 'Email':
        qc.invalidateQueries({ queryKey: ['threads'] });
        qc.invalidateQueries({ queryKey: ['emails'] });
        qc.invalidateQueries({ queryKey: ['emailDetail'] });
        // Fire new-mail listeners ONLY if no recent local mutation caused this.
        // Local mutations (delete, move, flag) trigger Email state changes on
        // the server which echo back — those should NOT play the notification.
        if (Date.now() - this._lastLocalMutation > LOCAL_MUTATION_SUPPRESS_MS) {
          this.newMailListeners.forEach((fn) => fn());
        }
        break;

      case 'Mailbox':
        qc.invalidateQueries({ queryKey: ['mailboxes'] });
        break;

      case 'Thread':
        qc.invalidateQueries({ queryKey: ['threads'] });
        break;

      case 'EmailDelivery':
        qc.invalidateQueries({ queryKey: ['threads'] });
        // EmailDelivery is always new inbound mail — always notify
        this.newMailListeners.forEach((fn) => fn());
        break;

      default:
        // Unknown / future JMAP type — no-op.
        break;
    }
  }

  private _scheduleReconnect(): void {
    if (this._destroyed) return;

    logger.debug(
      `[JMAP WebSocket] Reconnecting in ${this.reconnectDelay}ms…`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._openConnection();
    }, this.reconnectDelay);

    // Exponential back-off, capped at MAX_BACKOFF_MS.
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_BACKOFF_MS);
  }
}

export const webSocketManager = new WebSocketManager();
