/**
 * Tests for src/hooks/jmap/useEmailQueries.ts
 *
 * Focus (BUG-2026-053): the SearchSnippet/get filter MUST be composed
 * structurally through the same mergeFiltersAND pipeline as the main
 * Email/query filter. Hand-flattening conditions with Object.assign used to
 * clobber duplicate singular keys (two `header:` filters or two keywords),
 * so snippets were filtered differently than the query that produced ids.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useThreads } from '../jmap/useEmailQueries';
import { jmapClient } from '../../api/jmap';
import { fetchWithOfflineCache } from '../../utils/offlineCache';
import { createTestEmail } from '../../test/testUtils';
import type { SearchFilter } from '../../types/search';

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount: vi.fn(),
    request: vi.fn(),
  },
}));

vi.mock('../../utils/offlineCache', () => ({
  fetchWithOfflineCache: vi.fn((_keys: unknown, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../jmap/queryCacheUtils', () => ({
  suppressNewMailNotification: vi.fn(),
}));

vi.mock('../jmap/useEmailMutations', () => ({
  updateEmailStateFromResponse: vi.fn(),
  isExplicitlyMarkedUnread: vi.fn(() => false),
}));

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

type RequestCall = [string, Record<string, unknown>, string];

function methodResponse(name: string, data: unknown) {
  return { methodResponses: [[name, data, '0']] as [string, unknown, string][], sessionState: 'test-state' };
}

describe('useThreads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('acct-1');
  });

  it('builds identical filters for Email/query and SearchSnippet/get when two header filters are active', async () => {
    const dialogFilter: SearchFilter = {
      headerFilters: [
        { headerName: 'List-Id', value: 'v1' },
        { headerName: 'X-Test', value: 'v2' },
      ],
    };

    let emailQueryFilter: unknown;
    let snippetFilter: unknown;

    vi.mocked(jmapClient.request).mockImplementation(async (calls: unknown) => {
      const [method, params] = (calls as RequestCall[])[0];
      switch (method) {
        case 'Email/query':
          emailQueryFilter = params.filter;
          return methodResponse('Email/query', { ids: ['e1'] });
        case 'Email/get':
          return methodResponse('Email/get', { list: [createTestEmail({ id: 'e1' })] });
        case 'Thread/get':
          return methodResponse('Thread/get', { list: [{ id: 't1', emailIds: ['e1'] }] });
        case 'SearchSnippet/get':
          snippetFilter = params.filter;
          return methodResponse('SearchSnippet/get', {
            list: [{ emailId: 'e1', preview: 'hello snippet', subject: 'Test Subject' }],
          });
        default:
          throw new Error(`Unexpected JMAP method: ${method}`);
      }
    });

    const { result } = renderHook(
      () => useThreads('mb-inbox', 'hello', dialogFilter),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Both header conditions survive in the main Email/query filter.
    // Shape: mailbox condition ANDed with the search filter (itself an
    // allOf of colliding header conditions ANDed with the free text) —
    // nested FilterOperators are valid per RFC 8620 §5.5.
    expect(emailQueryFilter).toEqual({
      allOf: [
        { inMailbox: 'mb-inbox' },
        {
          allOf: [
            { allOf: [{ header: ['List-Id', 'v1'] }, { header: ['X-Test', 'v2'] }] },
            { text: 'hello' },
          ],
        },
      ],
    });
    // Regression assertion: the snippet filter matches the query filter
    // EXACTLY (previously the second `header` key overwrote the first).
    expect(snippetFilter).toEqual(emailQueryFilter);
    expect(result.current.data?.[0]?.searchSnippet).toBe('hello snippet');
  });

  it('keeps flat (non-colliding) mailbox + text conditions flattened for both requests', async () => {
    let emailQueryFilter: unknown;
    let snippetFilter: unknown;

    vi.mocked(jmapClient.request).mockImplementation(async (calls: unknown) => {
      const [method, params] = (calls as RequestCall[])[0];
      switch (method) {
        case 'Email/query':
          emailQueryFilter = params.filter;
          return methodResponse('Email/query', { ids: ['e1'] });
        case 'Email/get':
          return methodResponse('Email/get', { list: [createTestEmail({ id: 'e1' })] });
        case 'Thread/get':
          return methodResponse('Thread/get', { list: [{ id: 't1', emailIds: ['e1'] }] });
        case 'SearchSnippet/get':
          snippetFilter = params.filter;
          return methodResponse('SearchSnippet/get', { list: [] });
        default:
          throw new Error(`Unexpected JMAP method: ${method}`);
      }
    });

    const { result } = renderHook(
      () => useThreads('mb-inbox', 'meeting notes'),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // RFC 8621 §4.4.1 allows { inMailbox, text } together in one condition —
    // no allOf needed when no singular keys collide.
    const expected = { inMailbox: 'mb-inbox', text: 'meeting notes' };
    expect(emailQueryFilter).toEqual(expected);
    expect(snippetFilter).toEqual(expected);
  });

  it('falls back to raw searchTerm text when no structured constraints exist', async () => {
    let snippetFilter: unknown;

    vi.mocked(jmapClient.request).mockImplementation(async (calls: unknown) => {
      const [method, params] = (calls as RequestCall[])[0];
      switch (method) {
        case 'Email/query':
          return methodResponse('Email/query', { ids: ['e1'] });
        case 'Email/get':
          return methodResponse('Email/get', { list: [createTestEmail({ id: 'e1' })] });
        case 'Thread/get':
          return methodResponse('Thread/get', { list: [{ id: 't1', emailIds: ['e1'] }] });
        case 'SearchSnippet/get':
          snippetFilter = params.filter;
          return methodResponse('SearchSnippet/get', { list: [] });
        default:
          throw new Error(`Unexpected JMAP method: ${method}`);
      }
    });

    renderHook(() => useThreads(undefined, 'weird-query'), { wrapper: Wrapper });

    await waitFor(() => expect(jmapClient.request).toHaveBeenCalled());
    // No mailbox constraint (mailboxId undefined), no parsed filters — the
    // snippet request still carries the free-text term rather than an empty
    // filter.
    expect(snippetFilter).toEqual({ text: 'weird-query' });
  });
});
