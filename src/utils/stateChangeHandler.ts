import type { QueryClient } from '@tanstack/react-query';
import { stateManager } from '../api/stateManager';
import { logger } from './logger';
import { sharedNotificationSuppressor } from './notificationSuppressor';

export type NewMailListener = () => void;

export interface StateChangeHandler {
  /**
   * Process a JMAP StateChange notification and invalidate relevant queries.
   * @param changed The changed object from a StateChange payload (accountId -> {dataType -> state})
   * @param newMailListeners Set of listeners to notify for new mail events
   */
  handleStateChange(
    changed: Record<string, Record<string, string>>,
    newMailListeners: Set<NewMailListener>,
  ): void;

  /** Invalidate queries for a specific data type */
  invalidateForType(dataType: string, newMailListeners: Set<NewMailListener>): void;
}

/**
 * Creates a state change handler that manages query invalidation for JMAP push notifications.
 */
export function createStateChangeHandler(
  queryClient: QueryClient | null,
  options: {
    localMutationSuppressMs?: number;
    logPrefix?: string;
  } = {},
): StateChangeHandler {
  const { logPrefix = '[StateChange]' } = options;

  function invalidateForType(dataType: string, newMailListeners: Set<NewMailListener>): void {
    const qc = queryClient;
    if (!qc) return;

    switch (dataType) {
      case 'Email':
        qc.invalidateQueries({ queryKey: ['threads'] });
        qc.invalidateQueries({ queryKey: ['emails'] });
        qc.invalidateQueries({ queryKey: ['emailDetail'] });
        // Fire new-mail listeners ONLY if no recent local mutation caused this.
        if (!sharedNotificationSuppressor.shouldSuppress(3000)) {
          newMailListeners.forEach((fn) => fn());
        }
        break;

      case 'Mailbox':
        qc.invalidateQueries({ queryKey: ['mailboxes'] });
        break;

      case 'Thread':
        qc.invalidateQueries({ queryKey: ['threads'] });
        break;

      case 'EmailDelivery':
        qc.invalidateQueries({ queryKey: ['threads'] });
        // EmailDelivery is always new inbound mail — always notify
        newMailListeners.forEach((fn) => fn());
        break;

      default:
        // Unknown type — ignore
        break;
    }
  }

  function handleStateChange(
    changed: Record<string, Record<string, string>>,
    newMailListeners: Set<NewMailListener>,
  ): void {
    if (!queryClient) return;

    for (const [, typeMap] of Object.entries(changed)) {
      for (const [dataType, newState] of Object.entries(typeMap)) {
        const oldState = stateManager.getState(dataType);

        if (oldState === newState) continue; // nothing changed

        logger.debug(`${logPrefix} State change: ${dataType} ${oldState} → ${newState}`);
        stateManager.setState(dataType, newState);

        invalidateForType(dataType, newMailListeners);
      }
    }
  }

  return { handleStateChange, invalidateForType };
}
