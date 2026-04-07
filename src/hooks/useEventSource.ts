import { useEffect, useRef, useState, useCallback } from 'react';
import { eventSourceManager } from '../api/eventSource';
import { jmapClient } from '../api/jmap';
import { queryClient } from '../main';
import { playNotificationSound } from '../utils/notificationSound';
import { logger } from '../utils/logger';
import { extractAuthToken } from '../utils/auth';

export interface UseEventSourceResult {
  isConnected: boolean;
  hasNewMail: boolean;
  clearNewMail: () => void;
}

export function useEventSource(enabled: boolean): UseEventSourceResult {
  const [isConnected, setIsConnected] = useState<boolean>(
    () => eventSourceManager.isConnected(),
  );
  const [hasNewMail, setHasNewMail] = useState(false);

  // Keep a ref so the interval callback always reads the latest value
  const isConnectedRef = useRef(isConnected);

  const clearNewMail = useCallback(() => {
    setHasNewMail(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const url = jmapClient.getEventSourceUrl();
    const authHeader = jmapClient.getAuthHeader();

    if (!url || !authHeader) {
      logger.warn('[useEventSource] Missing EventSource URL or auth header — skipping connect');
      return;
    }

    // Strip "Basic " prefix — the token is already base64-encoded
    const authToken = extractAuthToken(authHeader);

    // Connect the singleton manager
    logger.debug('[useEventSource] Connecting to', url);
    eventSourceManager.connect(url, authToken, queryClient);

    // Subscribe to new-mail notifications
    const unsubscribeNewMail = eventSourceManager.onNewMail(() => {
      setHasNewMail(true);
      playNotificationSound();
    });

    // Subscribe to connection state changes for immediate updates
    const unsubscribeConnectionState = eventSourceManager.onConnectionStateChange((connected) => {
      logger.debug('[useEventSource] Connection state changed:', connected);
      isConnectedRef.current = connected;
      setIsConnected(connected);
    });

    // Poll the connection state as a fallback in case callbacks are missed.
    // EventSource doesn't expose a "connected" event on its own.
    const pollInterval = setInterval(() => {
      const connected = eventSourceManager.isConnected();
      if (connected !== isConnectedRef.current) {
        logger.debug('[useEventSource] Connection state changed (poll):', connected);
        isConnectedRef.current = connected;
        setIsConnected(connected);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      unsubscribeNewMail();
      unsubscribeConnectionState();
      eventSourceManager.disconnect();
      setIsConnected(false);
    };
    // jmapClient is a stable singleton; getEventSourceUrl/getAuthHeader are synchronous
    // accessors that read from the current session state. Including them would cause
    // unnecessary reconnects since these method references can change. We only want
    // to reconnect when `enabled` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { isConnected, hasNewMail, clearNewMail };
}
