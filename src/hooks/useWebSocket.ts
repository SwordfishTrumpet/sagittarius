import { useEffect, useRef, useState, useCallback } from 'react';
import { webSocketManager } from '../api/websocket';
import { jmapClient } from '../api/jmap';
import { queryClient } from '../main';
import { playNotificationSound } from '../utils/notificationSound';
import { logger, redactUrl } from '../utils/logger';
import { extractAuthToken } from '../utils/auth';

export interface UseWebSocketResult {
  isConnected: boolean;
  hasNewMail: boolean;
  clearNewMail: () => void;
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
  
  // Rewrite to use the same origin (current page's host), but preserve the path
  // This ensures CSP 'self' allows the connection
  const currentProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sameOriginUrl = `${currentProtocol}//${window.location.host}${parsed.pathname}`;
  
  const separator = sameOriginUrl.includes('?') ? '&' : '?';
  return `${sameOriginUrl}${separator}access_token=${encodeURIComponent(authToken)}`;
}

export function useWebSocket(enabled: boolean): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState<boolean>(
    () => webSocketManager.isConnected(),
  );
  const [hasNewMail, setHasNewMail] = useState(false);

  const isConnectedRef = useRef(isConnected);

  const clearNewMail = useCallback(() => {
    setHasNewMail(false);
  }, []);

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

    // Also poll periodically as a fallback in case callbacks are missed
    const pollInterval = setInterval(() => {
      const connected = webSocketManager.isConnected();
      if (connected !== isConnectedRef.current) {
        logger.debug('[useWebSocket] Connection state changed (poll):', connected);
        isConnectedRef.current = connected;
        setIsConnected(connected);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      unsubscribeNewMail();
      unsubscribeConnectionState();
      webSocketManager.disconnect();
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected, hasNewMail, clearNewMail };
}
