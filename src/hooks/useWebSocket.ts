import { useEffect, useRef, useState, useCallback } from 'react';
import { webSocketManager } from '../api/websocket';
import { jmapClient } from '../api/jmap';
import { queryClient } from '../main';
import { playNotificationSound } from '../utils/notificationSound';
import { logger, redactUrl } from '../utils/logger';

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
   */
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}access_token=${encodeURIComponent(authToken)}`;
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

    const authToken = authHeader.startsWith('Basic ')
      ? authHeader.slice(6)
      : authHeader;

    const finalUrl = buildWebSocketUrl(url, authToken);
    logger.debug('[useWebSocket] Connecting to', redactUrl(finalUrl));

    webSocketManager.connect(finalUrl, 'jmap', queryClient);

    const unsubscribeNewMail = webSocketManager.onNewMail(() => {
      setHasNewMail(true);
      playNotificationSound();
    });

    const pollInterval = setInterval(() => {
      const connected = webSocketManager.isConnected();
      if (connected !== isConnectedRef.current) {
        isConnectedRef.current = connected;
        setIsConnected(connected);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      unsubscribeNewMail();
      webSocketManager.disconnect();
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected, hasNewMail, clearNewMail };
}
