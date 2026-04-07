/**
 * RFC 9610 JMAP Contacts Hooks
 * 
 * React Query hooks for JMAP Contacts operations per RFC 9610.
 * Includes AddressBook and ContactCard methods with proper caching and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { jmapClient } from '../../api/jmap';
import { logger } from '../../utils/logger';
import type {
  AddressBook,
  ContactCard,
  AddressBookFilter,
  ContactCardFilter,
  AddressBookGetResponse,
  ContactCardGetResponse,
  AddressBookSetResponse,
  ContactCardSetResponse,
  AddressBookChangesResponse,
  ContactCardChangesResponse,
  ContactCardQueryResponse,
  AddressBookSetRequest,
  ContactCardSetRequest,
} from '../../types/jmap-contacts';
import { createJMAPListHook, createJMAPSingletonHook } from './jmapHookFactory';

const CONTACTS_CAPABILITY = 'urn:ietf:params:jmap:contacts';

// ============ Capability Check ============

/**
 * Check if the server supports RFC 9610 JMAP Contacts
 */
export function hasContactsCapability(): boolean {
  return jmapClient.hasCapability(CONTACTS_CAPABILITY);
}

/**
 * Get the contacts capability configuration
 */
export function getContactsCapability() {
  return jmapClient.getAccountCapability(CONTACTS_CAPABILITY);
}

/**
 * Hook to check if contacts capability is available
 */
export function useHasContactsCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return hasContactsCapability() && !!accountId;
}

// ============ AddressBook Hooks ============

/**
 * Hook to fetch all AddressBooks
 */
export function useAddressBooks(
  options?: Omit<UseQueryOptions<AddressBook[], Error, AddressBook[], [string, string | null]>, 'queryKey' | 'queryFn'>
) {
  const accountId = jmapClient.getPrimaryAccount();
  const isEnabled = !!accountId && hasContactsCapability();

  return useQuery({
    queryKey: ['addressBooks', accountId],
    queryFn: async () => {
      const response = await jmapClient.request(
        [['AddressBook/get', { accountId: accountId!, ids: null }, 'getAddressBooks0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch address books');
      }

      const result = methodRes[1] as AddressBookGetResponse;
      return result.list;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch the default AddressBook
 */
export function useDefaultAddressBook(
  options?: Omit<UseQueryOptions<AddressBook | null, Error, AddressBook | null, [string, string | null, string]>, 'queryKey' | 'queryFn'>
) {
  const accountId = jmapClient.getPrimaryAccount();
  const isEnabled = !!accountId && hasContactsCapability();

  return useQuery({
    queryKey: ['addressBooks', accountId, 'default'],
    queryFn: async () => {
      const response = await jmapClient.request(
        [['AddressBook/get', { accountId: accountId!, ids: null }, 'getAddressBooks0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch address books');
      }

      const result = methodRes[1] as AddressBookGetResponse;
      return result.list.find(ab => ab.isDefault) || result.list[0] || null;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook for AddressBook changes (incremental sync)
 */
export function useAddressBookChanges() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation({
    mutationFn: async (sinceState: string) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['AddressBook/changes', { accountId, sinceState }, 'addressBookChanges0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to get address book changes');
      }

      return methodRes[1] as AddressBookChangesResponse;
    },
    onSuccess: (data) => {
      // Invalidate cache if there are changes
      if (data.created.length > 0 || data.updated.length > 0 || data.destroyed.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['addressBooks', accountId] });
      }
    },
  });
}

/**
 * Hook for AddressBook mutations (create, update, delete)
 */
export function useAddressBookActions() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  const mutation = useMutation({
    mutationFn: async (request: Omit<AddressBookSetRequest, 'accountId'>) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['AddressBook/set', { accountId, ...request }, 'addressBookSet0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'AddressBook operation failed');
      }

      return methodRes[1] as AddressBookSetResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBooks', accountId] });
    },
  });

  return {
    createAddressBook: async (addressBook: Omit<AddressBook, 'id'>) => {
      const result = await mutation.mutateAsync({
        create: { [generateCreationId()]: addressBook },
      });
      return result.created;
    },
    updateAddressBook: async (id: string, update: Partial<AddressBook>) => {
      const result = await mutation.mutateAsync({
        update: { [id]: update },
      });
      return result.updated;
    },
    deleteAddressBook: async (id: string, removeContents = false) => {
      const result = await mutation.mutateAsync({
        destroy: [id],
        onDestroyRemoveContents: removeContents,
      });
      return result.destroyed;
    },
    setDefaultAddressBook: async (id: string) => {
      const result = await mutation.mutateAsync({
        onSuccessSetIsDefault: id,
      });
      return result;
    },
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============ ContactCard Hooks ============

/**
 * Hook to fetch all ContactCards
 */
export function useContactCards(
  options?: Omit<UseQueryOptions<ContactCard[], Error, ContactCard[], [string, string | null]>, 'queryKey' | 'queryFn'>
) {
  const accountId = jmapClient.getPrimaryAccount();
  const isEnabled = !!accountId && hasContactsCapability();

  return useQuery({
    queryKey: ['contactCards', accountId],
    queryFn: async () => {
      const response = await jmapClient.request(
        [['ContactCard/get', { accountId: accountId!, ids: null }, 'getContactCards0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch contact cards');
      }

      const result = methodRes[1] as ContactCardGetResponse;
      return result.list;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch ContactCards in a specific AddressBook
 */
export function useAddressBookContacts(
  addressBookId: string | null,
  options?: Omit<UseQueryOptions<ContactCard[], Error, ContactCard[], [string, string | null, string | null]>, 'queryKey' | 'queryFn'>
) {
  const accountId = jmapClient.getPrimaryAccount();
  const isEnabled = !!accountId && !!addressBookId && hasContactsCapability();

  return useQuery({
    queryKey: ['contactCards', accountId, addressBookId],
    queryFn: async () => {
      // First get all contacts, then filter by addressBook
      const response = await jmapClient.request(
        [['ContactCard/get', { accountId: accountId!, ids: null }, 'getContactCards0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch contact cards');
      }

      const result = methodRes[1] as ContactCardGetResponse;
      return result.list.filter(card => addressBookId && card.addressBookIds[addressBookId]);
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to query ContactCards with filtering and sorting
 */
export function useContactCardQuery(
  filter?: ContactCardFilter,
  sort?: Array<{ property: string; isAscending?: boolean }>,
  limit?: number,
  options?: Omit<UseQueryOptions<ContactCardQueryResponse, Error, ContactCardQueryResponse, [string, string | null, string, string, number | undefined]>, 'queryKey' | 'queryFn'>
) {
  const accountId = jmapClient.getPrimaryAccount();
  const isEnabled = !!accountId && hasContactsCapability();

  return useQuery({
    queryKey: ['contactCardQuery', accountId, JSON.stringify(filter), JSON.stringify(sort), limit],
    queryFn: async () => {
      const request: {
        accountId: string;
        filter?: ContactCardFilter;
        sort?: Array<{ property: string; isAscending?: boolean }>;
        limit?: number;
      } = {
        accountId: accountId!,
      };

      if (filter) request.filter = filter;
      if (sort) request.sort = sort;
      if (limit) request.limit = limit;

      const response = await jmapClient.request(
        [['ContactCard/query', request, 'contactCardQuery0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to query contact cards');
      }

      return methodRes[1] as ContactCardQueryResponse;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook for ContactCard changes (incremental sync)
 */
export function useContactCardChanges() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation({
    mutationFn: async (sinceState: string) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['ContactCard/changes', { accountId, sinceState }, 'contactCardChanges0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to get contact card changes');
      }

      return methodRes[1] as ContactCardChangesResponse;
    },
    onSuccess: (data) => {
      if (data.created.length > 0 || data.updated.length > 0 || data.destroyed.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['contactCards', accountId] });
        queryClient.invalidateQueries({ queryKey: ['contactCardQuery', accountId] });
      }
    },
  });
}

/**
 * Hook for ContactCard mutations (create, update, delete)
 */
export function useContactCardActions() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  const mutation = useMutation({
    mutationFn: async (request: Omit<ContactCardSetRequest, 'accountId'>) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['ContactCard/set', { accountId, ...request }, 'contactCardSet0']],
        [CONTACTS_CAPABILITY]
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'ContactCard operation failed');
      }

      return methodRes[1] as ContactCardSetResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactCards', accountId] });
      queryClient.invalidateQueries({ queryKey: ['contactCardQuery', accountId] });
    },
  });

  return {
    createContactCard: async (contactCard: Omit<ContactCard, 'id'>) => {
      const result = await mutation.mutateAsync({
        create: { [generateCreationId()]: contactCard },
      });
      return result.created;
    },
    updateContactCard: async (id: string, update: Partial<ContactCard>) => {
      const result = await mutation.mutateAsync({
        update: { [id]: update },
      });
      return result.updated;
    },
    deleteContactCard: async (id: string) => {
      const result = await mutation.mutateAsync({
        destroy: [id],
      });
      return result.destroyed;
    },
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============ Search Hook ============

/**
 * Hook to search ContactCards by text
 */
export function useContactSearch(
  searchTerm: string,
  addressBookId?: string,
  options?: Omit<UseQueryOptions<ContactCard[], Error, ContactCard[], [string, string | null, string, string | undefined]>, 'queryKey' | 'queryFn'>
) {
  const accountId = jmapClient.getPrimaryAccount();
  const isEnabled = !!accountId && hasContactsCapability() && searchTerm.length > 0;

  return useQuery({
    queryKey: ['contactSearch', accountId, searchTerm, addressBookId],
    queryFn: async () => {
      const filter: ContactCardFilter = {
        text: searchTerm,
      };

      if (addressBookId) {
        (filter as Record<string, unknown>).inAddressBook = addressBookId;
      }

      // First do a query to get matching IDs
      const queryResponse = await jmapClient.request(
        [['ContactCard/query', { accountId: accountId!, filter }, 'contactQuery0']],
        [CONTACTS_CAPABILITY]
      );

      const queryMethodRes = queryResponse.methodResponses[0];
      if (!queryMethodRes || queryMethodRes[0] === 'error') {
        const error = queryMethodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Contact search query failed');
      }

      const queryResult = queryMethodRes[1] as ContactCardQueryResponse;

      if (queryResult.ids.length === 0) {
        return [];
      }

      // Then fetch the actual contact cards
      const getResponse = await jmapClient.request(
        [['ContactCard/get', { accountId: accountId!, ids: queryResult.ids }, 'contactGet0']],
        [CONTACTS_CAPABILITY]
      );

      const getMethodRes = getResponse.methodResponses[0];
      if (!getMethodRes || getMethodRes[0] === 'error') {
        const error = getMethodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch search results');
      }

      const getResult = getMethodRes[1] as ContactCardGetResponse;
      return getResult.list;
    },
    enabled: isEnabled,
    staleTime: 30 * 1000, // 30 seconds for search results
    ...options,
  });
}

// ============ Utility Functions ============

/**
 * Generate a unique creation ID for JMAP set operations
 */
function generateCreationId(): string {
  return `c${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
