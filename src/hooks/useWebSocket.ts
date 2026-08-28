import { useEffect, useRef, useState, useCallback } from 'react';
import { webSocketManager } from '../api/websocket';
import { jmapClient } from '../api/jmap';
import { queryClient } from '../api/queryClient';
import { playNotificationSound } from '../utils/notificationSound';
import { logger, redactUrl } from '../utils/logger';
import { extractAuthToken } from '../utils/auth';

export interface UseWebSocketResult {
  isConnected: boolean;
  hasNewMail: boolean;
  clearNewMail: () => void;
  /** True when the circuit breaker tripped (server unreachable). */
  isTerminal: boolean;
  /** Reset the circuit breaker and reconnect now. */
  retry: () => void;
}

function buildWebSocketUrl(rawUrl: string, authToken: string): string {
  /**
   * SECURITY WARNING:
   * - This mirrors the EventSource fallback auth approach because the browser
   *   WebSocket API cannot attach custom Authorization headers.
   * - `authToken` is Base64-encoded Basic credentials (username:password), not
   *   a revocable session token, so it must never be logged unredacted.
   * - The local proxy reads `access_token` from the request URL and forwards
   *   the upstream request with an Authorization header.
   * 
   * CSP COMPATIBILITY:
   * - The JMAP session returns a WebSocket URL pointing to the JMAP server.
   * - We rewrite this to use the same origin (current hostname) so CSP
   *   can stay strict with just 'self' for connect-src.
   * - The server proxies WebSocket connections to the actual JMAP backend.
   */
  
  // Parse the JMAP WebSocket URL to get the path
  const parsed = new URL(rawUrl);
  
  // Rewrite to use the same origin (current page's host), but preserve the
  // path AND any query parameters the backend may require (tenant hints,
  // capability flags, etc.). This ensures CSP 'self' allows the connection.
  const currentProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${currentProtocol}//${window.location.host}${parsed.pathname}`;
  const withQuery = parsed.search ? `${base}${parsed.search}` : base;
  
  const separator = withQuery.includes('?') ? '&' : '?';
  return `${withQuery}${separator}access_token=${encodeURIComponent(authToken)}`;
}

export function useWebSocket(enabled: boolean): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState<boolean>(
    () => webSocketManager.isConnected(),
  );
  const [isTerminal, setIsTerminal] = useState<boolean>(
    () => webSocketManager.isTerminal(),
  );
  const [hasNewMail, setHasNewMail] = useState(false);

  const isConnectedRef = useRef(isConnected);
  const isTerminalRef = useRef(isTerminal);

  const clearNewMail = useCallback(() => {
    setHasNewMail(false);
  }, []);

  const retry = useCallback(() => {
    if (!enabled) return;
    webSocketManager.retry();
  }, [enabled]);

  // Reset connection state when push is disabled (enabled flipped false).
  // Deliberately NOT done inside the effect cleanup: cleanup runs after
  // unmount too, and setting state there is a side effect on an unmounted
  // component (React 19 StrictMode double-invokes effects in dev).
  useEffect(() => {
    if (!enabled) {
      isConnectedRef.current = false;
      setIsConnected(false);
      setIsTerminal(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const url = jmapClient.getWebSocketUrl();
    const authHeader = jmapClient.getAuthHeader();

    if (!url || !authHeader) {
      logger.warn('[useWebSocket] Missing WebSocket URL or auth header — skipping connect');
      return;
    }

    const authToken = extractAuthToken(authHeader);

    const finalUrl = buildWebSocketUrl(url, authToken);
    logger.debug('[useWebSocket] Connecting to', redactUrl(finalUrl));

    webSocketManager.connect(finalUrl, 'jmap', queryClient);

    const unsubscribeNewMail = webSocketManager.onNewMail(() => {
      setHasNewMail(true);
      playNotificationSound();
    });

    // Subscribe to connection state changes for immediate updates
    const unsubscribeConnectionState = webSocketManager.onConnectionStateChange((connected) => {
      logger.debug('[useWebSocket] Connection state changed:', connected);
      isConnectedRef.current = connected;
      setIsConnected(connected);
    });

    // Subscribe to circuit-breaker changes (issue #3)
    const unsubscribeTerminalState = webSocketManager.onTerminalStateChange((terminal) => {
      logger.debug('[useWebSocket] Terminal state changed:', terminal);
      setIsTerminal(terminal);
    });

    // Also poll periodically as a fallback in case callbacks are missed
    const pollInterval = setInterval(() => {
      const connected = webSocketManager.isConnected();
      if (connected !== isConnectedRef.current) {
        logger.debug('[useWebSocket] Connection state changed (poll):', connected);
        isConnectedRef.current = connected;
        setIsConnected(connected);
      }
      const terminal = webSocketManager.isTerminal();
      if (terminal !== isTerminalRef.current) {
        isTerminalRef.current = terminal;
        setIsTerminal(terminal);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      unsubscribeNewMail();
      unsubscribeConnectionState();
      unsubscribeTerminalState();
      webSocketManager.disconnect();
    };
  }, [enabled]);

  return { isConnected, hasNewMail, clearNewMail, isTerminal, retry };
}
