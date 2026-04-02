import type { QueryClient } from '@tanstack/react-query';
import { suppressNewMailNotification, rollbackQueries } from './queryCacheUtils';

export interface OptimisticUpdateContext {
  previousData: [any, any][];
  queryKeys: string[][];
}

export interface OptimisticEmailUpdateOptions<TData> {
  queryClient: QueryClient;
  /** Query keys to update (e.g., ['threads'], ['emails']) */
  queryKeys: string[][];
  /** Function to apply the optimistic patch to each email item */
  applyPatch: (email: any) => any;
  /** Optional filter to determine which emails to patch */
  shouldPatch?: (email: any) => boolean;
  /** Callback before the update (e.g., cancel queries) */
  onBeforeUpdate?: () => Promise<void>;
}

/**
 * Performs an optimistic update on email queries.
 * Captures the previous state, applies the patch, and returns rollback context.
 */
export async function performOptimisticEmailUpdate<TData>({
  queryClient,
  queryKeys,
  applyPatch,
  shouldPatch = () => true,
  onBeforeUpdate,
}: OptimisticEmailUpdateOptions<TData>): Promise<{ previousSnapshots: [any, any][][] }> {
  // Suppress notifications for local mutations
  suppressNewMailNotification();

  // Run pre-update hook if provided
  if (onBeforeUpdate) {
    await onBeforeUpdate();
  }

  // Cancel relevant queries to prevent race conditions
  for (const key of queryKeys) {
    await queryClient.cancelQueries({ queryKey: key });
  }

  // Capture previous snapshots
  const previousSnapshots: [any, any][][] = [];

  // Apply optimistic updates
  for (const baseKey of queryKeys) {
    const previous = queryClient.getQueriesData({ queryKey: baseKey });
    previousSnapshots.push(previous);

    previous.forEach(([queryKey, oldData]) => {
      if (!Array.isArray(oldData)) return;
      queryClient.setQueryData(queryKey, oldData.map((email: any) =>
        shouldPatch(email) ? applyPatch(email) : email,
      ));
    });
  }

  return { previousSnapshots };
}

/**
 * Rollback optimistic updates from captured snapshots.
 */
export function rollbackOptimisticUpdates(
  queryClient: QueryClient,
  snapshots: [any, any][][] | undefined,
): void {
  if (!snapshots) return;
  snapshots.forEach((snapshot) => rollbackQueries(queryClient, snapshot));
}

/**
 * Creates a factory function for common email optimistic update patterns.
 * Returns the onMutate and onError handlers for useMutation.
 */
export function createEmailOptimisticHandlers<TVariables>(options: {
  queryClient: QueryClient;
  /** Query keys to update */
  queryKeys: string[][];
  /** Get the email IDs to patch from mutation variables */
  getEmailIds: (vars: TVariables) => string[] | Set<string>;
  /** Get the patch to apply from mutation variables */
  getPatch: (vars: TVariables) => Record<string, any>;
  /** Optional additional query keys to cancel */
  extraCancelKeys?: string[][];
}) {
  const { queryClient, queryKeys, getEmailIds, getPatch, extraCancelKeys = [] } = options;

  return {
    onMutate: async (variables: TVariables) => {
      const emailIds = getEmailIds(variables);
      const emailIdSet = emailIds instanceof Set ? emailIds : new Set(emailIds);
      const patch = getPatch(variables);

      const allCancelKeys = [...queryKeys, ...extraCancelKeys];

      // Capture previous data BEFORE applying optimistic update (for correct rollback)
      const previousData: [any, any][][] = [];
      for (const key of queryKeys) {
        previousData.push(queryClient.getQueriesData({ queryKey: key }));
      }

      await performOptimisticEmailUpdate({
        queryClient,
        queryKeys: allCancelKeys,
        applyPatch: (email: any) => ({ ...email, ...patch }),
        shouldPatch: (email: any) => emailIdSet.has(email.id),
        onBeforeUpdate: async () => {
          for (const key of allCancelKeys) {
            await queryClient.cancelQueries({ queryKey: key });
          }
        },
      });

      return { previousData, queryKeys };
    },

    onError: (_err: unknown, _vars: TVariables, context: { previousData?: [any, any][][] } | undefined) => {
      if (context?.previousData) {
        rollbackOptimisticUpdates(queryClient, context.previousData);
      }
    },
  };
}
