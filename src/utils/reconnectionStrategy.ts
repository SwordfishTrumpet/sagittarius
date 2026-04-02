/**
 * ReconnectionStrategy — Shared exponential backoff reconnection logic
 * for WebSocket and EventSource managers.
 */

export interface ReconnectionOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}

export interface ReconnectionStrategy {
  /** Current reconnect delay in milliseconds */
  readonly currentDelay: number;
  /** Number of reconnection attempts made */
  readonly attempts: number;
  /** Calculate the next delay and increment attempts */
  nextDelay(): number;
  /** Reset the strategy to initial state */
  reset(): void;
  /** Check if max attempts has been exceeded */
  isMaxAttemptsReached(): boolean;
}

/**
 * Creates a reconnection strategy with exponential backoff.
 */
export function createReconnectionStrategy(options: ReconnectionOptions = {}): ReconnectionStrategy {
  const {
    baseDelayMs = 1000,
    maxDelayMs = 60000,
    maxAttempts = Infinity,
  } = options;

  let attempts = 0;
  let currentDelay = baseDelayMs;

  return {
    get currentDelay() {
      return currentDelay;
    },
    get attempts() {
      return attempts;
    },
    nextDelay(): number {
      const delay = currentDelay;
      attempts += 1;
      // Exponential back-off, capped at maxDelayMs
      currentDelay = Math.min(currentDelay * 2, maxDelayMs);
      return delay;
    },
    reset(): void {
      attempts = 0;
      currentDelay = baseDelayMs;
    },
    isMaxAttemptsReached(): boolean {
      return attempts >= maxAttempts;
    },
  };
}

/**
 * Default constants for reconnection timing.
 */
export const RECONNECTION_DEFAULTS = {
  BASE_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 60000,
} as const;
