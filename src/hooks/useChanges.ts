import { jmapClient } from '../api/jmap';
import { stateManager } from '../api/stateManager';
import { logger } from '../utils/logger';

export interface ChangesResult {
  created: any[];
  updated: any[];
  destroyed: string[];
  newState: string;
}

/**
 * applyChanges — incremental sync helper.
 *
 * Fetches only the changes since the last known JMAP state for `type`.
 * Returns null if a full fetch is needed (no prior state, or the server
 * cannot calculate changes from the given state).
 *
 * @param type  JMAP data type, e.g. "Email" | "Mailbox" | "Thread"
 * @param properties  Properties to fetch for created/updated records (Email/get etc.)
 */
export async function applyChanges(
  type: 'Email' | 'Mailbox' | 'Thread',
  properties?: string[],
): Promise<ChangesResult | null> {
  const accountId = jmapClient.getPrimaryAccount();
  if (!accountId) return null;

  // Step 1: do we have a prior state?
  const oldState = stateManager.getState(type);
  if (!oldState) {
    return null; // caller should fall back to a full fetch
  }

  // Step 2: call Foo/changes
  let changesResponse;
  try {
    changesResponse = await jmapClient.request([
      [`${type}/changes`, {
        accountId,
        sinceState: oldState,
        maxChanges: 500,
      }, '0'],
    ]);
  } catch (err) {
    logger.warn(`[applyChanges] ${type}/changes request failed:`, err);
    return null;
  }

  const [methodName, methodResult] = changesResponse.methodResponses[0];

  // cannotCalculateChanges or any other error → full fetch needed
  if (methodName === 'error') {
    if (methodResult?.type === 'cannotCalculateChanges') {
      logger.info(`[applyChanges] ${type}: cannotCalculateChanges — falling back to full fetch`);
    } else {
      logger.warn(`[applyChanges] ${type}/changes error:`, methodResult);
    }
    return null;
  }

  const {
    created: createdIds = [] as string[],
    updated: updatedIds = [] as string[],
    destroyed: destroyedIds = [] as string[],
    newState,
  } = methodResult as {
    created: string[];
    updated: string[];
    destroyed: string[];
    newState: string;
  };

  // Step 3: fetch data for created + updated IDs
  const idsToFetch = [...createdIds, ...updatedIds];
  let createdItems: any[] = [];
  let updatedItems: any[] = [];

  if (idsToFetch.length > 0) {
    const getArgs: Record<string, any> = { accountId, ids: idsToFetch };
    if (properties && properties.length > 0) {
      getArgs.properties = properties;
    }

    let getResponse;
    try {
      getResponse = await jmapClient.request([
        [`${type}/get`, getArgs, '1'],
      ]);
    } catch (err) {
      logger.warn(`[applyChanges] ${type}/get request failed:`, err);
      // Return null so the caller falls back to a full refresh
      return null;
    }

    const [getMethodName, getResult] = getResponse.methodResponses[0];
    if (getMethodName === 'error') {
      logger.warn(`[applyChanges] ${type}/get error:`, getResult);
      return null;
    }

    const list: any[] = getResult.list ?? [];
    const createdSet = new Set(createdIds);
    createdItems = list.filter((item: any) => createdSet.has(item.id));
    updatedItems = list.filter((item: any) => !createdSet.has(item.id));
  }

  // Step 4: persist the new state
  stateManager.setState(type, newState);

  return {
    created: createdItems,
    updated: updatedItems,
    destroyed: destroyedIds,
    newState,
  };
}
