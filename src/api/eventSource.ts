import { QueryClient } from '@tanstack/react-query';
import { stateManager } from './stateManager';
import { logger, redactUrl } from '../utils/logger';

type StateChangePayload = {
  changed: {
    [accountId: string]: {
      [dataType: string]: string; // dataType → newState
    };
  };
};

type NewMailListener = () => void;

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Duration (ms) after a local mutation during which we suppress new-mail
 * notifications.  The server echoes our own changes back as Email state
 * updates — this window prevents those from playing the notification sound.
 */
const LOCAL_MUTATION_SUPPRESS_MS = 3_000;

class EventSourceManager {
  private es: EventSource | null = null;
  private queryClient: QueryClient | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private _isConnected = false;
  private url: string | null = null;
  private authToken: string | null = null;
  private newMailListeners: Set<NewMailListener> = new Set();
  private _destroyed = false;

  /**
   * Timestamp of the last local Email mutation (delete, move, flag, etc.).
   * While Date.now() − _lastLocalMutation < LOCAL_MUTATION_SUPPRESS_MS,
   * Email state changes will NOT fire new-mail listeners.
   */
  private _lastLocalMutation = 0;

  /**
   * Build the final EventSource URL from the JMAP server template.
   * Template variables: {types}, {closeafter}, {ping}
   *
   * Auth is appended as an `access_token` query param. This is a practical
   * necessity because the browser's EventSource API (W3C Server-Sent Events
   * spec) does not support custom request headers like Authorization.
   * RFC 8620 §7.3 requires an "authenticated GET request" but does not
   * prescribe how to pass credentials for EventSource specifically.
   *
   * SECURITY WARNING:
   * - The token is Base64-encoded Basic Auth credentials (username:password),
   *   NOT a revocable session token. Credential rotation requires a password change.
   * - The token will appear in server access logs, proxy/CDN logs, and browser history.
   * - Always use HTTPS in production to protect the token in transit.
   * - Prefer WebSocket push (RFC 8887) as the primary push mechanism where supported,
   *   as it uses subprotocol auth and avoids URL-embedded credentials.
   */
  private buildUrl(rawUrl: string, authToken: string): string {
    let url = rawUrl
      .replace('{types}', '*')
      .replace('{closeafter}', 'no')
      .replace('{ping}', '30');

    const separator = url.includes('?') ? '&' : '?';
    // authToken is already base64-encoded (stripped from "Basic <b64>" header)
    return `${url}${separator}access_token=${authToken}`;
  }

  connect(url: string, authToken: string, queryClient: QueryClient): void {
    this._destroyed = false;
    this.url = url;
    this.authToken = authToken;
    this.queryClient = queryClient;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  private openConnection(): void {
    if (this._destroyed || !this.url || !this.authToken || !this.queryClient) return;

    const finalUrl = this.buildUrl(this.url, this.authToken);
    logger.debug('[EventSource] Connecting to', redactUrl(finalUrl));

    const es = new EventSource(finalUrl);
    this.es = es;

    es.onopen = () => {
      logger.debug('[EventSource] Connected');
      this._isConnected = true;
      this.reconnectAttempts = 0;
    };

    es.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    // Server sends typed events; also handle the generic 'state' event
    es.addEventListener('state', (event: MessageEvent) => {
      this.handleMessage(event.data);
    });

    es.onerror = (err) => {
      logger.warn('[EventSource] Error / connection lost', err);
      this._isConnected = false;
      es.close();
      this.es = null;
      this.scheduleReconnect();
    };
  }

  private handleMessage(data: string): void {
    let payload: StateChangePayload;
    try {
      payload = JSON.parse(data);
    } catch {
      logger.warn('[EventSource] Failed to parse event data:', data);
      return;
    }

    if (!payload?.changed) return;

    for (const [, typeMap] of Object.entries(payload.changed)) {
      for (const [dataType, newState] of Object.entries(typeMap)) {
        const oldState = stateManager.getState(dataType);

        if (oldState === newState) continue; // nothing changed

        logger.debug(`[EventSource] State change: ${dataType} ${oldState} → ${newState}`);
        stateManager.setState(dataType, newState);

        this.invalidateForType(dataType);
      }
    }
  }

  private invalidateForType(dataType: string): void {
    const qc = this.queryClient;
    if (!qc) return;

    switch (dataType) {
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
        // Unknown type — ignore
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this._destroyed) return;

    const delay = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, this.reconnectAttempts),
      MAX_BACKOFF_MS,
    );
    this.reconnectAttempts += 1;
    logger.debug(`[EventSource] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, delay);
  }

  disconnect(): void {
    this._destroyed = true;
    this._isConnected = false;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.es) {
      this.es.close();
      this.es = null;
    }

    logger.debug('[EventSource] Disconnected');
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  /** Subscribe to new-mail (EmailDelivery) events. Returns an unsubscribe fn. */
  onNewMail(listener: NewMailListener): () => void {
    this.newMailListeners.add(listener);
    return () => this.newMailListeners.delete(listener);
  }

  /**
   * Call this before performing a local Email mutation (delete, move, flag,
   * keyword update, etc.) so that the server's echo of our own change does
   * not trigger the new-mail notification sound.
   */
  suppressNotification(): void {
    this._lastLocalMutation = Date.now();
  }
}

export const eventSourceManager = new EventSourceManager();
