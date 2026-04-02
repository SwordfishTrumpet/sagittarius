/**
 * NotificationSuppressor — Shared utility for suppressing new-mail notifications
 * after local mutations. Both EventSource and WebSocket managers use this to
 * prevent notification sounds when the server echoes our own changes back.
 */

export interface NotificationSuppressor {
  suppress(): void;
  shouldSuppress(suppressMs?: number): boolean;
  getLastMutationTime(): number;
}

/**
 * Creates a notification suppressor instance.
 * @param suppressMs Duration (ms) after a local mutation during which notifications are suppressed
 */
export function createNotificationSuppressor(suppressMs: number = 3000): NotificationSuppressor {
  let lastLocalMutation = 0;

  return {
    suppress(): void {
      lastLocalMutation = Date.now();
    },
    shouldSuppress(overrideMs?: number): boolean {
      const effectiveMs = overrideMs ?? suppressMs;
      return Date.now() - lastLocalMutation < effectiveMs;
    },
    getLastMutationTime(): number {
      return lastLocalMutation;
    },
  };
}

// Default suppressor for shared use across push managers
export const sharedNotificationSuppressor = createNotificationSuppressor(3000);
