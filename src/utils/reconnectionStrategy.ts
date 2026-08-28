/**
 * ReconnectionStrategy — Shared exponential backoff reconnection logic
 * for WebSocket and EventSource managers.
 *
 * Circuit-breaker semantics (issue #3): a connection that has NEVER
 * succeeded and fails `maxInitialFailures` times in a row is classified as
 * server-unreachable (persistent failure class — dead DNS, refused
 * connections, proxy 502). The strategy goes terminal and the manager stops
 * scheduling attempts until the user retries. Once a connection has EVER
 * succeeded, failures are treated as transient and keep the current
 * backoff behavior (per the issue: persistent classes stop after N
 * attempts; transient classes keep retrying).
 */

export interface ReconnectionOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  /**
   * Give up (terminal state) after this many consecutive failures while the
   * connection has NEVER succeeded. Default Infinity preserves the previous
   * forever-retry behavior. Set to a small number (e.g. 3) to enable the
   * unreachable-class circuit breaker.
   */
  maxInitialFailures?: number;
}

export interface ReconnectionStrategy {
  /** Current reconnect delay in milliseconds */
  readonly currentDelay: number;
  /** Number of reconnection attempts made */
  readonly attempts: number;
  /** Calculate the next delay and increment attempts */
  nextDelay(): number;
  /** Reset the strategy to initial state (clears terminal + ever-connected) */
  reset(): void;
  /** Check if max attempts has been exceeded */
  isMaxAttemptsReached(): boolean;
  /**
   * Record a failed connection attempt that happened BEFORE any successful
   * connection. Returns true when the strategy just became terminal
   * (unreachable-class give-up) and the caller must stop reconnecting.
   */
  recordInitialFailure(): boolean;
  /** Record a successful connection (clears terminal, resets backoff). */
  recordSuccess(): void;
  /** True when the strategy has given up (unreachable-class). */
  isTerminal(): boolean;
}

/**
 * Creates a reconnection strategy with exponential backoff.
 */
export function createReconnectionStrategy(options: ReconnectionOptions = {}): ReconnectionStrategy {
  const {
    baseDelayMs = 1000,
    maxDelayMs = 60000,
    maxAttempts = Infinity,
    maxInitialFailures = Infinity,
  } = options;

  let attempts = 0;
  let currentDelay = baseDelayMs;
  let initialFailures = 0;
  let everConnected = false;
  let terminal = false;

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
      initialFailures = 0;
      everConnected = false;
      terminal = false;
    },
    isMaxAttemptsReached(): boolean {
      return attempts >= maxAttempts;
    },
    recordInitialFailure(): boolean {
      if (everConnected || terminal) return false;
      initialFailures += 1;
      if (initialFailures >= maxInitialFailures) {
        terminal = true;
        return true;
      }
      return false;
    },
    recordSuccess(): void {
      everConnected = true;
      initialFailures = 0;
      terminal = false;
      attempts = 0;
      currentDelay = baseDelayMs;
    },
    isTerminal(): boolean {
      return terminal;
    },
  };
}

/**
 * Default constants for reconnection timing.
 */
export const RECONNECTION_DEFAULTS = {
  BASE_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 60000,
  /** Failures before giving up on a never-connected (unreachable) endpoint. */
  MAX_INITIAL_FAILURES: 3,
} as const;
