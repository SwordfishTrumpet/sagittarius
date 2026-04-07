/**
 * Integration Tests for Email Import, MDN, and Sieve Workflows
 * 
 * These tests verify end-to-end workflows including:
 * 1. Email Import: Drag-and-drop .eml import flow
 * 2. MDN Workflow: Read receipt request and send flow  
 * 3. Sieve CRUD: Filter creation, update, deletion flow
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useEmailImport } from '../useEmailImport';
import { useSendMDN } from '../useMDN';
import { useSieve, useSieveActions } from '../useSieve';
import { jmapClient } from '../../api/jmap';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper for React Query hooks
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Standard JMAP Session for tests
function makeSession(overrides: Record<string, any> = {}) {
  return {
    username: 'user@example.com',
    apiUrl: 'https://mail.example.com/jmap/',
    downloadUrl: 'https://mail.example.com/jmap/download/{accountId}/{blobId}/{name}?accept={type}',
    uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
    eventSourceUrl: 'https://mail.example.com/jmap/eventsource/',
    capabilities: {
      'urn:ietf:params:jmap:core': {},
      'urn:ietf:params:jmap:mail': {},
      'urn:ietf:params:jmap:submission': {},
      'urn:ietf:params:jmap:mdn': {}, // MDN support
      'urn:ietf:params:jmap:sieve': {}, // Sieve support
    },
    accounts: {
      'account-001': {
        name: 'user@example.com',
        isPersonal: true,
        accountCapabilities: {
          'urn:ietf:params:jmap:mail': {},
          'urn:ietf:params:jmap:submission': {},
          'urn:ietf:params:jmap:mdn': {},
          'urn:ietf:params:jmap:sieve': {},
        },
      },
    },
    primaryAccounts: {
      'urn:ietf:params:jmap:mail': 'account-001',
      'urn:ietf:params:jmap:submission': 'account-001',
    },
    state: 'session-state-001',
    ...overrides,
  };
}

describe('Integration Tests — Email Import Workflow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeAll(() => {
    // Mock sessionStorage
    const mockSessionStorage: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
      removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
      clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
      get length() { return Object.keys(mockSessionStorage).length; },
      key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
    });
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupAuthenticatedClient() {
    const session = makeSession();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => session,
      text: async () => JSON.stringify(session),
    });
    await jmapClient.authenticate('user@example.com', 'password');
  }

  it('should import an .eml file via Email/import', async () => {
    await setupAuthenticatedClient();

    // Email/import the blob
    const emailImportResponse = {
      accountId: 'account-001',
      created: {
        'import-1': {
          id: 'email-imported-123',
          blobId: 'imported-blob-123',
          threadId: 'thread-imported-123',
          size: 2048,
        },
      },
      notCreated: {},
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [['Email/import', emailImportResponse, '0']],
        sessionState: 's1',
      }),
    });

    // Render the hook
    const { result } = renderHook(() => useEmailImport(), {
      wrapper: createWrapper(queryClient),
    });

    // Execute import
    await result.current.mutateAsync({
      blobId: 'imported-blob-123',
      mailboxIds: { inbox: true },
      keywords: { $seen: true },
    });

    // Wait for and verify the mutation succeeded
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should handle Email/import failure gracefully', async () => {
    await setupAuthenticatedClient();

    const errorResponse = {
      accountId: 'account-001',
      notCreated: {
        'import-1': {
          type: 'invalidProperties',
          description: 'Invalid mailboxIds',
        },
      },
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [['Email/import', errorResponse, '0']],
        sessionState: 's1',
      }),
    });

    const { result } = renderHook(() => useEmailImport(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({
        blobId: 'invalid-blob',
        mailboxIds: { invalidMailbox: true },
      })
    ).rejects.toThrow('Invalid mailboxIds');
  });
});

describe('Integration Tests — MDN (Read Receipt) Workflow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeAll(() => {
    const mockSessionStorage: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
      removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
      clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
      get length() { return Object.keys(mockSessionStorage).length; },
      key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
    });
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupAuthenticatedClient() {
    const session = makeSession();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => session,
      text: async () => JSON.stringify(session),
    });
    await jmapClient.authenticate('user@example.com', 'password');
  }

  it('should send MDN for email with Disposition-Notification-To', async () => {
    await setupAuthenticatedClient();

    const mdnSendResponse = {
      accountId: 'account-001',
      sent: {
        'mdn-1': {
          emailId: 'mdn-reply-123',
        },
      },
      notSent: {},
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [['MDN/send', mdnSendResponse, '0']],
        sessionState: 's1',
      }),
    });

    const { result } = renderHook(() => useSendMDN(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      emailId: 'email-with-mdn-123',
      identityId: 'identity-001',
    });

    // Wait for mutation to complete
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should handle MDN send failure', async () => {
    await setupAuthenticatedClient();

    const mdnErrorResponse = {
      accountId: 'account-001',
      sent: {},
      notSent: {
        'mdn-1': {
          type: 'invalidArguments',
          description: 'Invalid identity',
        },
      },
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [['MDN/send', mdnErrorResponse, '0']],
        sessionState: 's1',
      }),
    });

    const { result } = renderHook(() => useSendMDN(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({
        emailId: 'email-123',
        identityId: 'invalid-identity',
      })
    ).rejects.toThrow('Invalid identity');
  });
});

describe('Integration Tests — Sieve Filter CRUD', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeAll(() => {
    const mockSessionStorage: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
      removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
      clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
      get length() { return Object.keys(mockSessionStorage).length; },
      key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
    });
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupAuthenticatedClient() {
    const session = makeSession();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => session,
      text: async () => JSON.stringify(session),
    });
    await jmapClient.authenticate('user@example.com', 'password');
  }

  it('should fetch sieve scripts on mount', async () => {
    await setupAuthenticatedClient();

    const sieveGetResponse = {
      accountId: 'account-001',
      list: [
        {
          id: 'sieve-001',
          name: 'Vacation Filter',
          blobId: 'blob-001',
          isActive: true,
        },
        {
          id: 'sieve-002',
          name: 'Spam Filter',
          blobId: 'blob-002',
          isActive: false,
        },
      ],
      notFound: [],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [['SieveScript/get', sieveGetResponse, '0']],
        sessionState: 's1',
      }),
    });

    const { result } = renderHook(() => useSieve(), {
      wrapper: createWrapper(queryClient),
    });

    // Wait for the query to resolve
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe('Vacation Filter');
  });

  it('should create a new sieve script', async () => {
    await setupAuthenticatedClient();

    // Initial fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [['SieveScript/get', { accountId: 'account-001', list: [] }, '0']],
        sessionState: 's1',
      }),
    });

    const Wrapper = createWrapper(queryClient);
    
    const { result: sieveResult } = renderHook(() => useSieve(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(sieveResult.current.data).toBeDefined());

    // Create new script
    const createResponse = {
      methodResponses: [
        [
          'SieveScript/set',
          {
            accountId: 'account-001',
            created: {
              'new-1': { id: 'sieve-new-123', name: 'New Filter', blobId: 'blob-new', isActive: true },
            },
            notCreated: {},
          },
          '0',
        ],
      ],
      sessionState: 's1',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => createResponse,
    });

    const { result: actionsResult } = renderHook(() => useSieveActions(), {
      wrapper: Wrapper,
    });

    await actionsResult.current.createScript.mutateAsync({
      name: 'New Filter',
      blobId: 'blob-new',
      isActive: true,
    });

    // Wait for mutation to complete
    await waitFor(() => expect(actionsResult.current.createScript.isSuccess).toBe(true));
  });

  it('should update an existing sieve script', async () => {
    await setupAuthenticatedClient();

    // Initial fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [
          [
            'SieveScript/get',
            { 
              accountId: 'account-001', 
              list: [{ id: 'sieve-001', name: 'Old Name', blobId: 'blob-001', isActive: false }] 
            },
            '0',
          ],
        ],
        sessionState: 's1',
      }),
    });

    const Wrapper = createWrapper(queryClient);
    
    const { result: sieveResult } = renderHook(() => useSieve(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(sieveResult.current.data).toBeDefined());

    // Update script
    const updateResponse = {
      methodResponses: [
        [
          'SieveScript/set',
          {
            accountId: 'account-001',
            updated: { 'sieve-001': { name: 'Updated Name', isActive: true } },
            notUpdated: {},
          },
          '0',
        ],
      ],
      sessionState: 's1',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => updateResponse,
    });

    const { result: actionsResult } = renderHook(() => useSieveActions(), {
      wrapper: Wrapper,
    });

    await actionsResult.current.updateScript.mutateAsync({
      id: 'sieve-001',
      patch: { name: 'Updated Name', isActive: true },
    });

    // Wait for mutation to complete
    await waitFor(() => expect(actionsResult.current.updateScript.isSuccess).toBe(true));
  });

  it('should delete a sieve script', async () => {
    await setupAuthenticatedClient();

    // Initial fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methodResponses: [
          [
            'SieveScript/get',
            { 
              accountId: 'account-001', 
              list: [{ id: 'sieve-001', name: 'To Delete', blobId: 'blob-001', isActive: false }] 
            },
            '0',
          ],
        ],
        sessionState: 's1',
      }),
    });

    const Wrapper = createWrapper(queryClient);
    
    const { result: sieveResult } = renderHook(() => useSieve(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(sieveResult.current.data).toBeDefined());

    // Delete script
    const deleteResponse = {
      methodResponses: [
        [
          'SieveScript/set',
          {
            accountId: 'account-001',
            destroyed: ['sieve-001'],
            notDestroyed: {},
          },
          '0',
        ],
      ],
      sessionState: 's1',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => deleteResponse,
    });

    const { result: actionsResult } = renderHook(() => useSieveActions(), {
      wrapper: Wrapper,
    });

    await actionsResult.current.deleteScript.mutateAsync('sieve-001');

    // Wait for mutation to complete
    await waitFor(() => expect(actionsResult.current.deleteScript.isSuccess).toBe(true));
  });
});
