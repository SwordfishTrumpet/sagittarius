import { QueryClient } from '@tanstack/react-query';
import { stateManager } from './stateManager';
import { logger, redactUrl } from '../utils/logger';
import { createReconnectionStrategy, RECONNECTION_DEFAULTS } from '../utils/reconnectionStrategy';
import { createStateChangeHandler, type NewMailListener } from '../utils/stateChangeHandler';
import { sharedNotificationSuppressor } from '../utils/notificationSuppressor';

type StateChangePayload = {
  changed: {
    [accountId: string]: {
      [dataType: string]: string; // dataType → newState
    };
  };
};

class EventSourceManager {
  private es: EventSource | null = null;
  private queryClient: QueryClient | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private url: string | null = null;
  private authToken: string | null = null;
  private newMailListeners: Set<NewMailListener> = new Set();
  private connectionStateListeners: Set<(connected: boolean) => void> = new Set();
  private _destroyed = false;
  private _isConnected = false;

  private reconnectionStrategy = createReconnectionStrategy({
    baseDelayMs: RECONNECTION_DEFAULTS.BASE_BACKOFF_MS,
    maxDelayMs: RECONNECTION_DEFAULTS.MAX_BACKOFF_MS,
  });

  private stateChangeHandler = createStateChangeHandler(null, { logPrefix: '[EventSource]' });

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
    return `${url}${separator}access_token=${encodeURIComponent(authToken)}`;
  }

  connect(url: string, authToken: string, queryClient: QueryClient): void {
    this._destroyed = false;
    this.url = url;
    this.authToken = authToken;
    this.queryClient = queryClient;
    this.reconnectionStrategy.reset();
    // Update state change handler with the new queryClient
    this.stateChangeHandler = createStateChangeHandler(queryClient, { logPrefix: '[EventSource]' });
    this.openConnection();
  }

  private openConnection(): void {
    if (this._destroyed || !this.url || !this.authToken || !this.queryClient) return;

    // Log raw URL from server for diagnostics
    logger.debug('[EventSource] Raw URL from session:', this.url);
    
    const finalUrl = this.buildUrl(this.url, this.authToken);
    logger.info('[EventSource] Connecting to:', redactUrl(finalUrl));
    
    // Warn if template placeholders weren't replaced (indicates server URL format issue)
    if (finalUrl.includes('{types}') || finalUrl.includes('{closeafter}') || finalUrl.includes('{ping}')) {
      logger.warn('[EventSource] URL still contains template placeholders - server may have returned pre-formatted URL');
    }

    // Add cache-busting param to prevent aggressive caching of failed connections
    const cacheBustedUrl = finalUrl.includes('?') 
      ? `${finalUrl}&_cb=${Date.now()}` 
      : `${finalUrl}?_cb=${Date.now()}`;

    logger.debug('[EventSource] Cache-bust URL:', redactUrl(cacheBustedUrl));

    // Note: withCredentials defaults to false, but being explicit helps debugging
    // We use URL-based auth (access_token param) rather than cookies, so withCredentials=false is correct
    let es: EventSource;
    try {
      es = new EventSource(cacheBustedUrl, { withCredentials: false });
    } catch (err) {
      logger.error('[EventSource] Failed to construct EventSource:', err);
      this._isConnected = false;
      this.notifyConnectionStateChange(false);
      this.scheduleReconnect();
      return;
    }
    this.es = es;

    // Connection timeout - if onopen doesn't fire within 10s, treat as failure
    this.connectionTimeout = setTimeout(() => {
      if (!this._isConnected) {
        logger.warn('[EventSource] Connection timeout - no onopen event after 10s');
        es.close();
        this._isConnected = false;
        this.notifyConnectionStateChange(false);
        this.scheduleReconnect();
      }
    }, 10_000);

    es.onopen = () => {
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      logger.debug('[EventSource] Connected');
      this._isConnected = true;
      this.reconnectionStrategy.reset();
      this.notifyConnectionStateChange(true);
    };

    es.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    // Server sends typed events; also handle the generic 'state' event
    es.addEventListener('state', (event: MessageEvent) => {
      this.handleMessage(event.data);
    });

    es.onerror = (err) => {
      // Clear connection timeout if still pending
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      // Capture detailed error info for diagnostics
      const errorInfo = {
        readyState: es.readyState,
        url: redactUrl(finalUrl),
        event: err.type,
        timestamp: new Date().toISOString(),
      };
      
      logger.error('[EventSource] Connection error:', errorInfo);
      this._isConnected = false;
      this.notifyConnectionStateChange(false);
      es.close();
      this.es = null;
      
      // Schedule reconnect - the reconnection strategy will handle backoff
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

    // Use shared state change handler
    this.stateChangeHandler.handleStateChange(payload.changed, this.newMailListeners);
  }

  private scheduleReconnect(): void {
    if (this._destroyed) return;

    const delay = this.reconnectionStrategy.nextDelay();
    logger.warn(`[EventSource] Connection lost. Reconnecting in ${delay}ms... (attempt ${this.reconnectionStrategy.attempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, delay);
  }

  disconnect(): void {
    this._destroyed = true;
    this._isConnected = false;

    if (this.connectionTimeout !== null) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.es) {
      this.es.close();
      this.es = null;
    }

    // Clear auth token from memory after disconnect for security
    this.authToken = null;

    logger.debug('[EventSource] Disconnected');
  }

  isConnected(): boolean {
    // Check both the internal flag AND the actual EventSource readyState
    // EventSource.OPEN === 1
    return this._isConnected && this.es?.readyState === EventSource.OPEN;
  }

  /** Subscribe to new-mail (EmailDelivery) events. Returns an unsubscribe fn. */
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
        logger.error('[EventSource] Error in connection state listener:', err);
      }
    }
  }

  /**
   * Call this before performing a local Email mutation (delete, move, flag,
   * keyword update, etc.) so that the server's echo of our own change does
   * not trigger the new-mail notification sound.
   */
  suppressNotification(): void {
    sharedNotificationSuppressor.suppress();
  }
}

export const eventSourceManager = new EventSourceManager();
