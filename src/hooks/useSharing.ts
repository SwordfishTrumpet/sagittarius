import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import { createJMAPListHook } from './jmap/jmapHookFactory';
import type { Principal } from '../types/jmap-sharing';

const SHARING_CAP = 'urn:ietf:params:jmap:sharing';

export function useHasSharingCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(jmapClient.hasCapability(SHARING_CAP) && accountId);
}

export const usePrincipals = createJMAPListHook<Principal>(
  'Principal/get',
  'principals',
  {
    capability: SHARING_CAP,
    staleTime: 5 * 60 * 1000,
  }
);

export function usePrincipalQuery() {
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation({
    mutationFn: async (filter: { text?: string; email?: string; type?: string }) => {
      return jmapClient.queryPrincipals(filter, accountId ?? undefined);
    },
  });
}

export function useShareActions() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  const updateCalendarShares = useMutation({
    mutationFn: async ({
      calendarId,
      shareWith,
    }: {
      calendarId: string;
      shareWith: Record<string, { mayRead?: boolean; mayWrite?: boolean; mayAdmin?: boolean }>;
    }) => {
      return jmapClient.request(
        [['Calendar/set', { accountId, update: { [calendarId]: { shareWith } } }, '0']],
        ['urn:ietf:params:jmap:calendars']
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    },
  });

  const updateAddressBookShares = useMutation({
    mutationFn: async ({
      addressBookId,
      shareWith,
    }: {
      addressBookId: string;
      shareWith: Record<string, { mayRead?: boolean; mayWrite?: boolean; mayAdmin?: boolean }>;
    }) => {
      return jmapClient.request(
        [['AddressBook/set', { accountId, update: { [addressBookId]: { shareWith } } }, '0']],
        ['urn:ietf:params:jmap:contacts']
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBooks'] });
    },
  });

  return { updateCalendarShares, updateAddressBookShares };
}
