import { useEffect, useRef, useState, useCallback } from 'react';
import { eventSourceManager } from '../api/eventSource';
import { jmapClient } from '../api/jmap';
import { queryClient } from '../api/queryClient';
import { playNotificationSound } from '../utils/notificationSound';
import { logger } from '../utils/logger';
import { extractAuthToken } from '../utils/auth';

export interface UseEventSourceResult {
  isConnected: boolean;
  hasNewMail: boolean;
  clearNewMail: () => void;
  /** True when the circuit breaker tripped (server unreachable). */
  isTerminal: boolean;
  /** Reset the circuit breaker and reconnect now. */
  retry: () => void;
}

export function useEventSource(enabled: boolean): UseEventSourceResult {
  const [isConnected, setIsConnected] = useState<boolean>(
    () => eventSourceManager.isConnected(),
  );
  const [isTerminal, setIsTerminal] = useState<boolean>(
    () => eventSourceManager.isTerminal(),
  );
  const [hasNewMail, setHasNewMail] = useState(false);

  // Keep refs to avoid stale closures and ensure we always have fresh values
  const isConnectedRef = useRef(isConnected);
  const isTerminalRef = useRef(isTerminal);
  const enabledRef = useRef(enabled);
  
  // Update refs when props change
  enabledRef.current = enabled;

  const clearNewMail = useCallback(() => {
    setHasNewMail(false);
  }, []);

  const retry = useCallback(() => {
    if (!enabled) return;
    eventSourceManager.retry();
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
    if (!enabledRef.current) return;

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

    // Subscribe to circuit-breaker changes (issue #3)
    const unsubscribeTerminalState = eventSourceManager.onTerminalStateChange((terminal) => {
      logger.debug('[useEventSource] Terminal state changed:', terminal);
      setIsTerminal(terminal);
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
      const terminal = eventSourceManager.isTerminal();
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
      eventSourceManager.disconnect();
    };
  }, [enabled]);

  return { isConnected, hasNewMail, clearNewMail, isTerminal, retry };
}
