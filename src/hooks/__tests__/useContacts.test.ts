/**
 * Tests for RFC 9610 JMAP Contacts hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import {
  hasContactsCapability,
  useHasContactsCapability,
  useAddressBooks,
  useDefaultAddressBook,
  useAddressBookActions,
  useContactCards,
  useContactCardActions,
  useContactSearch,
  useContactCardQuery,
} from '../jmap/useContacts';
import { jmapClient } from '../../api/jmap';
import type { AddressBook, ContactCard } from '../../types/jmap-contacts';

// Mock the JMAP client
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount: vi.fn(),
    hasCapability: vi.fn(),
    getAccountCapability: vi.fn(),
    request: vi.fn(),
  },
}));

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = createTestQueryClient();
  return React.createElement(QueryClientProvider, { client }, children);
};

describe('useContacts hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Capability checking', () => {
    it('hasContactsCapability returns true when server supports contacts', () => {
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      expect(hasContactsCapability()).toBe(true);
      expect(jmapClient.hasCapability).toHaveBeenCalledWith('urn:ietf:params:jmap:contacts');
    });

    it('hasContactsCapability returns false when server does not support contacts', () => {
      vi.mocked(jmapClient.hasCapability).mockReturnValue(false);

      expect(hasContactsCapability()).toBe(false);
    });

    it('useHasContactsCapability returns true when capability is available', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      const { result } = renderHook(() => useHasContactsCapability(), { wrapper: Wrapper });

      expect(result.current).toBe(true);
    });

    it('useHasContactsCapability returns false when no account', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue(null);

      const { result } = renderHook(() => useHasContactsCapability(), { wrapper: Wrapper });

      expect(result.current).toBe(false);
    });
  });

  describe('useAddressBooks', () => {
    const mockAddressBooks: AddressBook[] = [
      {
        id: 'addrbook-1',
        name: 'Personal',
        description: null,
        sortOrder: 0,
        isDefault: true,
        isSubscribed: true,
        shareWith: null,
        myRights: {
          mayRead: true,
          mayWrite: true,
          mayShare: true,
          mayDelete: true,
        },
      },
      {
        id: 'addrbook-2',
        name: 'Work',
        description: 'Work contacts',
        sortOrder: 1,
        isDefault: false,
        isSubscribed: true,
        shareWith: null,
        myRights: {
          mayRead: true,
          mayWrite: true,
          mayShare: false,
          mayDelete: false,
        },
      },
    ];

    it('fetches address books successfully', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'AddressBook/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockAddressBooks,
              notFound: [],
            },
            'getAddressBooks0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useAddressBooks(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockAddressBooks);
      expect(jmapClient.request).toHaveBeenCalledWith(
        [['AddressBook/get', { accountId: 'account-1', ids: null }, 'getAddressBooks0']],
        ['urn:ietf:params:jmap:contacts']
      );
    });

    it('returns empty array when no address books', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'AddressBook/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: [],
              notFound: [],
            },
            'getAddressBooks0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useAddressBooks(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('is disabled when no account', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue(null);

      const { result } = renderHook(() => useAddressBooks(), { wrapper: Wrapper });

      expect(result.current.isPending).toBe(true);
    });

    it('handles error', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          ['error', { type: 'notFound', description: 'Account not found' }, 'getAddressBooks0'],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useAddressBooks(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toContain('Account not found');
    });
  });

  describe('useDefaultAddressBook', () => {
    const mockAddressBooks: AddressBook[] = [
      {
        id: 'addrbook-1',
        name: 'Personal',
        description: null,
        sortOrder: 0,
        isDefault: true,
        isSubscribed: true,
        shareWith: null,
        myRights: {
          mayRead: true,
          mayWrite: true,
          mayShare: true,
          mayDelete: true,
        },
      },
      {
        id: 'addrbook-2',
        name: 'Work',
        description: null,
        sortOrder: 1,
        isDefault: false,
        isSubscribed: true,
        shareWith: null,
        myRights: {
          mayRead: true,
          mayWrite: true,
          mayShare: false,
          mayDelete: false,
        },
      },
    ];

    it('returns the default address book', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'AddressBook/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockAddressBooks,
              notFound: [],
            },
            'getAddressBooks0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useDefaultAddressBook(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe('addrbook-1');
      expect(result.current.data?.isDefault).toBe(true);
    });

    it('returns first address book when no default', async () => {
      const noDefaultBooks = mockAddressBooks.map(ab => ({ ...ab, isDefault: false }));

      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'AddressBook/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: noDefaultBooks,
              notFound: [],
            },
            'getAddressBooks0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useDefaultAddressBook(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.id).toBe('addrbook-1');
    });

    it('returns null when no address books', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'AddressBook/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: [],
              notFound: [],
            },
            'getAddressBooks0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useDefaultAddressBook(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });
  });

  describe('useAddressBookActions', () => {
    beforeEach(() => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
    });

    it('creates address book successfully', async () => {
      const newAddressBook = {
        name: 'New Book',
        description: 'A new address book',
        sortOrder: 2,
        isSubscribed: true,
      };

      const createdAddressBook: AddressBook = {
        id: 'new-id-123',
        ...newAddressBook,
        isDefault: false,
        shareWith: null,
        myRights: {
          mayRead: true,
          mayWrite: true,
          mayShare: true,
          mayDelete: true,
        },
      };

      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'AddressBook/set',
            {
              accountId: 'account-1',
              newState: 'new-state',
              created: {
                c123: createdAddressBook,
              },
            },
            'addressBookSet0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useAddressBookActions(), { wrapper: Wrapper });

      // Wait for the hook to be ready
      await waitFor(() => expect(result.current.isPending).toBe(false));

      const created = await result.current.createAddressBook(newAddressBook as Omit<AddressBook, 'id'>);

      expect(created).toBeDefined();
      expect(created?.c123).toEqual(createdAddressBook);
    });

    it('deletes address book successfully', async () => {
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'AddressBook/set',
            {
              accountId: 'account-1',
              newState: 'new-state',
              destroyed: ['addrbook-1'],
            },
            'addressBookSet0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useAddressBookActions(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isPending).toBe(false));

      const destroyed = await result.current.deleteAddressBook('addrbook-1');

      expect(destroyed).toContain('addrbook-1');
    });
  });

  describe('useContactCards', () => {
    const mockContactCards: ContactCard[] = [
      {
        id: 'contact-1',
        addressBookIds: { 'addrbook-1': true },
        uid: 'uid-1',
        kind: 'individual',
        name: {
          components: [
            { kind: 'given', value: 'John' },
            { kind: 'surname', value: 'Doe' },
          ],
          full: 'John Doe',
        },
        emails: {
          'email-1': {
            address: 'john@example.com',
            contexts: { private: true },
          },
        },
      },
      {
        id: 'contact-2',
        addressBookIds: { 'addrbook-1': true },
        uid: 'uid-2',
        kind: 'individual',
        name: {
          components: [
            { kind: 'given', value: 'Jane' },
            { kind: 'surname', value: 'Smith' },
          ],
          full: 'Jane Smith',
        },
      },
    ];

    it('fetches contact cards successfully', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ContactCard/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockContactCards,
              notFound: [],
            },
            'getContactCards0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useContactCards(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name?.full).toBe('John Doe');
    });

    it('is disabled when no capability', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(false);

      const { result } = renderHook(() => useContactCards(), { wrapper: Wrapper });

      expect(result.current.isPending).toBe(true);
    });
  });

  describe('useContactCardActions', () => {
    beforeEach(() => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
    });

    it('creates contact card successfully', async () => {
      const newContact: Omit<ContactCard, 'id'> = {
        addressBookIds: { 'addrbook-1': true },
        name: {
          components: [{ kind: 'given', value: 'New' }, { kind: 'surname', value: 'Contact' }],
          full: 'New Contact',
        },
        emails: {
          'email-1': { address: 'new@example.com' },
        },
      };

      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ContactCard/set',
            {
              accountId: 'account-1',
              newState: 'new-state',
              created: {
                c123: {
                  id: 'contact-new',
                  ...newContact,
                },
              },
            },
            'contactCardSet0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useContactCardActions(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isPending).toBe(false));

      const created = await result.current.createContactCard(newContact);

      expect(created).toBeDefined();
      expect(created?.c123?.id).toBe('contact-new');
    });

    it('updates contact card successfully', async () => {
      const update = {
        name: {
          components: [{ kind: 'given', value: 'Updated' }, { kind: 'surname', value: 'Name' }],
          full: 'Updated Name',
        },
      };

      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ContactCard/set',
            {
              accountId: 'account-1',
              newState: 'new-state',
              updated: {
                'contact-1': update,
              },
            },
            'contactCardSet0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useContactCardActions(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isPending).toBe(false));

      const updated = await result.current.updateContactCard('contact-1', update);

      expect(updated).toBeDefined();
      expect(updated?.['contact-1']).toEqual(update);
    });
  });

  describe('useContactSearch', () => {
    it('searches contacts by text', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      // Mock the query response
      vi.mocked(jmapClient.request)
        .mockResolvedValueOnce({
          methodResponses: [
            [
              'ContactCard/query',
              {
                accountId: 'account-1',
                queryState: 'query-state-1',
                canCalculateChanges: true,
                position: 0,
                ids: ['contact-1', 'contact-2'],
                total: 2,
              },
              'contactQuery0',
            ],
          ],
          sessionState: 'session-state',
        })
        // Mock the get response
        .mockResolvedValueOnce({
          methodResponses: [
            [
              'ContactCard/get',
              {
                accountId: 'account-1',
                state: 'state-1',
                list: [
                  {
                    id: 'contact-1',
                    addressBookIds: { 'addrbook-1': true },
                    name: { full: 'John Doe' },
                  },
                  {
                    id: 'contact-2',
                    addressBookIds: { 'addrbook-1': true },
                    name: { full: 'Jane Doe' },
                  },
                ],
                notFound: [],
              },
              'contactGet0',
            ],
          ],
          sessionState: 'session-state',
        });

      const { result } = renderHook(() => useContactSearch('Doe'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name?.full).toBe('John Doe');
    });

    it('is disabled when search term is empty', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      const { result } = renderHook(() => useContactSearch(''), { wrapper: Wrapper });

      expect(result.current.isPending).toBe(true);
    });
  });

  describe('useContactCardQuery', () => {
    it('queries contacts with filter', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ContactCard/query',
            {
              accountId: 'account-1',
              queryState: 'query-state-1',
              canCalculateChanges: true,
              position: 0,
              ids: ['contact-1'],
              total: 1,
            },
            'contactCardQuery0',
          ],
        ],
        sessionState: 'session-state',
      });

      const filter = { inAddressBook: 'addrbook-1' };
      const { result } = renderHook(() => useContactCardQuery(filter), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.ids).toContain('contact-1');
      expect(result.current.data?.total).toBe(1);
    });

    it('queries contacts with sort', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ContactCard/query',
            {
              accountId: 'account-1',
              queryState: 'query-state-1',
              canCalculateChanges: true,
              position: 0,
              ids: ['contact-2', 'contact-1'],
              total: 2,
            },
            'contactCardQuery0',
          ],
        ],
        sessionState: 'session-state',
      });

      const sort = [{ property: 'name/given', isAscending: true }];
      const { result } = renderHook(() => useContactCardQuery(undefined, sort), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.ids).toHaveLength(2);
    });
  });
});
