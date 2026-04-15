/**
 * Rate Limiting Utilities
 * Provides client-side rate limiting for authentication and other sensitive operations
 */

export interface RateLimitState {
  attempts: number;
  firstAttemptTime: number;
  lockedUntil: number | null;
}

const RATE_LIMIT_KEY = 'auth_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 5 * 60 * 1000; // 5 minute window for attempt counting

/**
 * Get current rate limit state from sessionStorage
 */
function getRateLimitState(): RateLimitState {
  try {
    const stored = sessionStorage.getItem(RATE_LIMIT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore storage errors
  }
  return {
    attempts: 0,
    firstAttemptTime: 0,
    lockedUntil: null,
  };
}

/**
 * Save rate limit state to sessionStorage
 */
function saveRateLimitState(state: RateLimitState): void {
  try {
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if authentication is currently rate limited
 * Returns null if allowed, or remaining lockout seconds if blocked
 */
export function checkRateLimit(): number | null {
  const state = getRateLimitState();
  const now = Date.now();

  // Check if currently locked out
  if (state.lockedUntil && now < state.lockedUntil) {
    return Math.ceil((state.lockedUntil - now) / 1000);
  }

  // Reset lock if expired
  if (state.lockedUntil && now >= state.lockedUntil) {
    saveRateLimitState({
      attempts: 0,
      firstAttemptTime: 0,
      lockedUntil: null,
    });
    return null;
  }

  // Reset attempt count if window has passed
  if (state.attempts > 0 && now - state.firstAttemptTime > WINDOW_MS) {
    saveRateLimitState({
      attempts: 0,
      firstAttemptTime: 0,
      lockedUntil: null,
    });
    return null;
  }

  return null;
}

/**
 * Record a failed authentication attempt
 * Returns remaining attempts before lockout (0 if now locked)
 */
export function recordFailedAttempt(): number {
  const state = getRateLimitState();
  const now = Date.now();

  // Reset if outside window
  if (now - state.firstAttemptTime > WINDOW_MS) {
    state.attempts = 0;
    state.firstAttemptTime = now;
  }

  state.attempts += 1;

  // Check if should lock
  if (state.attempts >= MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_DURATION_MS;
    saveRateLimitState(state);
    return 0;
  }

  saveRateLimitState(state);
  return MAX_ATTEMPTS - state.attempts;
}

/**
 * Reset rate limit on successful authentication
 */
export function resetRateLimit(): void {
  saveRateLimitState({
    attempts: 0,
    firstAttemptTime: 0,
    lockedUntil: null,
  });
}

/**
 * Get rate limit status for display
 */
export function getRateLimitStatus(): {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutSeconds: number | null;
} {
  const lockoutSeconds = checkRateLimit();
  const state = getRateLimitState();

  if (lockoutSeconds) {
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutSeconds,
    };
  }

  return {
    isLocked: false,
    remainingAttempts: MAX_ATTEMPTS - state.attempts,
    lockoutSeconds: null,
  };
}
