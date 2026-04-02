import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { jmapClient, type JMAPResponse } from '../../api/jmap';
import type { JMAPRequestCall } from './queryCacheUtils';
import { extractGetResponse, type JMAPGetResponse } from '../../types/jmap';

/**
 * Factory function to create standardized JMAP query hooks.
 * Reduces boilerplate for common JMAP query patterns.
 *
 * @param method The JMAP method name (e.g., 'VacationResponse/get')
 * @param queryKeyBase The base query key for React Query (e.g., 'vacation')
 * @param options Additional options for hook creation
 * @returns A custom hook function that performs the JMAP query
 */
export function createJMAPQueryHook<TResult>(
  method: string,
  queryKeyBase: string,
  options: {
    /** Transform function for the raw JMAP response */
    transform?: (response: JMAPResponse) => TResult;
    /** Additional arguments for the JMAP method call */
    getArgs?: (accountId: string) => Record<string, unknown>;
    /** Required capability for this method */
    capability?: string;
    /** Default stale time for the query */
    staleTime?: number;
  } = {},
) {
  const {
    transform = (response: JMAPResponse) => {
      const result = extractGetResponse<TResult>(response.methodResponses);
      return (result?.list ?? []) as TResult;
    },
    getArgs = (accountId: string) => ({ accountId, ids: null }),
    capability,
    staleTime = 10 * 60 * 1000, // 10 minutes default
  } = options;

  return function useJMAPQuery(
    hookOptions?: Omit<UseQueryOptions<TResult, Error, TResult, [string, string | null]>, 'queryKey' | 'queryFn'>,
  ): UseQueryResult<TResult, Error> {
    const accountId = jmapClient.getPrimaryAccount();
    const isEnabled = !!accountId && (!capability || jmapClient.hasCapability(capability));

    return useQuery({
      queryKey: [queryKeyBase, accountId],
      queryFn: async () => {
        const args = getArgs(accountId!);
        const requests: JMAPRequestCall[] = [[method, args, '0']];
        const response = await jmapClient.request(requests);
        return transform(response);
      },
      enabled: isEnabled,
      staleTime,
      ...hookOptions,
    });
  };
}

/**
 * Factory for creating simple list-based JMAP query hooks.
 * This is the most common pattern for JMAP get methods.
 */
export function createJMAPListHook<TItem>(
  method: string,
  queryKeyBase: string,
  options: {
    getArgs?: (accountId: string) => Record<string, unknown>;
    capability?: string;
    staleTime?: number;
    /** Extract list from the response - defaults to response.methodResponses[0][1].list */
    extractList?: (response: JMAPResponse) => TItem[];
  } = {},
) {
  const {
    extractList = (response: JMAPResponse) => {
      const result = extractGetResponse<TItem>(response.methodResponses);
      return result?.list ?? [];
    },
    ...rest
  } = options;

  return createJMAPQueryHook<TItem[]>(method, queryKeyBase, {
    transform: extractList,
    ...rest,
  });
}

/**
 * Factory for creating singleton JMAP query hooks (e.g., VacationResponse).
 * Returns the first item from the list or null if empty.
 */
export function createJMAPSingletonHook<TResult>(
  method: string,
  queryKeyBase: string,
  options: {
    getArgs?: (accountId: string) => Record<string, unknown>;
    capability?: string;
    staleTime?: number;
  } = {},
) {
  return createJMAPQueryHook<TResult | null>(method, queryKeyBase, {
    transform: (response: JMAPResponse) => {
      const result = extractGetResponse<TResult>(response.methodResponses);
      const list = result?.list ?? [];
      return list[0] ?? null;
    },
    ...options,
  });
}
