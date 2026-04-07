/**
 * Thread Participant Search Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import {
  useThreadParticipantSearch,
  useThreadsInvolvingUser,
  useThreadsFromSender,
  useThreadsWithAttachmentsFrom,
  buildThreadParticipantFilter,
  useThreadParticipantFilterBuilder,
} from '../useThreadParticipantSearch';
import type { ThreadFilterCondition, ThreadFilterOperator } from '../../types/jmap';

// Mock the JMAP client
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    request: vi.fn(),
    getPrimaryAccount: () => 'account-1',
  },
}));

import { jmapClient } from '../../api/jmap';
import type { JMAPResponse } from '../../api/jmap';

// Helper to create properly typed mock response
function createMockResponse(...methodResponses: [string, unknown, string][]): JMAPResponse {
  return {
    methodResponses,
    sessionState: 'session-state-1',
  };
}

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

describe('useThreadParticipantSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildThreadParticipantFilter', () => {
    it('returns undefined for empty options', () => {
      const filter = buildThreadParticipantFilter({});
      expect(filter).toBeUndefined();
    });

    it('builds filter for single participant', () => {
      const filter = buildThreadParticipantFilter({ from: 'sender@example.com' });
      expect(filter).toEqual({ from: 'sender@example.com' });
    });

    it('builds filter with from and to', () => {
      const filter = buildThreadParticipantFilter({
        from: 'sender@example.com',
        to: 'recipient@example.com',
      });

      expect(filter).toEqual({
        allOf: [
          { from: 'sender@example.com' },
          { to: 'recipient@example.com' },
        ],
      });
    });

    it('builds filter with subject', () => {
      const filter = buildThreadParticipantFilter({
        subject: 'Project Update',
      });

      expect(filter).toEqual({ subject: 'Project Update' });
    });

    it('builds filter with hasAttachment', () => {
      const filter = buildThreadParticipantFilter({
        hasAttachment: true,
      });

      expect(filter).toEqual({ hasAttachment: true });
    });

    it('builds complex filter with all options', () => {
      const filter = buildThreadParticipantFilter({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Important',
        hasAttachment: true,
      });

      const operator = filter as ThreadFilterOperator;
      expect(operator.allOf).toHaveLength(4);
      expect(operator.allOf).toContainEqual({ from: 'sender@example.com' });
      expect(operator.allOf).toContainEqual({ to: 'recipient@example.com' });
      expect(operator.allOf).toContainEqual({ subject: 'Important' });
      expect(operator.allOf).toContainEqual({ hasAttachment: true });
    });

    it('includes additional filters', () => {
      const additional: ThreadFilterCondition[] = [
        { after: '2024-01-01T00:00:00Z' },
      ];

      const filter = buildThreadParticipantFilter({
        from: 'sender@example.com',
        additionalFilters: additional,
      });

      const operator = filter as ThreadFilterOperator;
      expect(operator.allOf).toHaveLength(2);
      expect(operator.allOf).toContainEqual({ from: 'sender@example.com' });
      expect(operator.allOf).toContainEqual({ after: '2024-01-01T00:00:00Z' });
    });
  });

  describe('useThreadParticipantSearch', () => {
    it('fetches threads with from filter', async () => {
      // First call: Thread/query response
      const queryResponse = createMockResponse(
        ['Thread/query', { accountId: 'account-1', ids: ['t1', 't2'], queryState: 'qs1' }, '0']
      );
      // Second call: Thread/get response
      const getResponse = createMockResponse(
        ['Thread/get', {
          accountId: 'account-1',
          list: [
            { id: 't1', emailIds: ['e1', 'e2'] },
            { id: 't2', emailIds: ['e3'] },
          ],
          state: 'ts1',
        }, '1']
      );

      vi.mocked(jmapClient.request)
        .mockResolvedValueOnce(queryResponse)
        .mockResolvedValueOnce(getResponse);

      const { result } = renderHook(
        () => useThreadParticipantSearch({ from: 'sender@example.com' }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      // First call is Thread/query, second is Thread/get
      expect(jmapClient.request).toHaveBeenNthCalledWith(1, [
        ['Thread/query', {
          accountId: 'account-1',
          filter: { from: 'sender@example.com' },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 100,
          position: 0,
        }, '0'],
      ]);
    });

    it('fetches threads with to filter', async () => {
      // First call: Thread/query response
      const queryResponse = createMockResponse(
        ['Thread/query', { accountId: 'account-1', ids: ['t1'], queryState: 'qs1' }, '0']
      );
      // Second call: Thread/get response
      const getResponse = createMockResponse(
        ['Thread/get', {
          accountId: 'account-1',
          list: [{ id: 't1', emailIds: ['e1'] }],
          state: 'ts1',
        }, '1']
      );

      vi.mocked(jmapClient.request)
        .mockResolvedValueOnce(queryResponse)
        .mockResolvedValueOnce(getResponse);

      const { result } = renderHook(
        () => useThreadParticipantSearch({ to: 'recipient@example.com' }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // First call is Thread/query, second is Thread/get
      expect(jmapClient.request).toHaveBeenNthCalledWith(1, [
        ['Thread/query', {
          accountId: 'account-1',
          filter: { to: 'recipient@example.com' },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 100,
          position: 0,
        }, '0'],
      ]);
    });

    it('respects limit option', async () => {
      // First call: Thread/query response
      const queryResponse = createMockResponse(
        ['Thread/query', { accountId: 'account-1', ids: ['t1'], queryState: 'qs1' }, '0']
      );
      // Second call: Thread/get response
      const getResponse = createMockResponse(
        ['Thread/get', {
          accountId: 'account-1',
          list: [{ id: 't1', emailIds: ['e1'] }],
          state: 'ts1',
        }, '1']
      );

      vi.mocked(jmapClient.request)
        .mockResolvedValueOnce(queryResponse)
        .mockResolvedValueOnce(getResponse);

      renderHook(
        () => useThreadParticipantSearch({ from: 'sender@example.com', limit: 25 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(vi.mocked(jmapClient.request)).toHaveBeenCalled());

      expect(jmapClient.request).toHaveBeenCalledWith([
        ['Thread/query', {
          accountId: 'account-1',
          filter: { from: 'sender@example.com' },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 25,
          position: 0,
        }, '0'],
      ]);
    });
  });

  describe('useThreadsInvolvingUser', () => {
    it('searches for threads where user is recipient', async () => {
      const mockResponse = createMockResponse(
        ['Thread/query', { accountId: 'account-1', ids: ['t1'], queryState: 'qs1' }, '0'],
        ['Thread/get', {
          accountId: 'account-1',
          list: [{ id: 't1', emailIds: ['e1'] }],
          state: 'ts1',
        }, '1']
      );

      vi.mocked(jmapClient.request).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useThreadsInvolvingUser('me@example.com', 30),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(jmapClient.request).toHaveBeenCalledWith([
        ['Thread/query', {
          accountId: 'account-1',
          filter: { to: 'me@example.com' },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 30,
          position: 0,
        }, '0'],
      ]);
    });
  });

  describe('useThreadsFromSender', () => {
    it('searches for threads from specific sender', async () => {
      const mockResponse = createMockResponse(
        ['Thread/query', { accountId: 'account-1', ids: ['t1'], queryState: 'qs1' }, '0'],
        ['Thread/get', {
          accountId: 'account-1',
          list: [{ id: 't1', emailIds: ['e1'] }],
          state: 'ts1',
        }, '1']
      );

      vi.mocked(jmapClient.request).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useThreadsFromSender('boss@example.com'),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(jmapClient.request).toHaveBeenCalledWith([
        ['Thread/query', {
          accountId: 'account-1',
          filter: { from: 'boss@example.com' },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 50,
          position: 0,
        }, '0'],
      ]);
    });
  });

  describe('useThreadsWithAttachmentsFrom', () => {
    it('searches for threads with attachments from sender', async () => {
      const mockResponse = createMockResponse(
        ['Thread/query', { accountId: 'account-1', ids: ['t1'], queryState: 'qs1' }, '0'],
        ['Thread/get', {
          accountId: 'account-1',
          list: [{ id: 't1', emailIds: ['e1'] }],
          state: 'ts1',
        }, '1']
      );

      vi.mocked(jmapClient.request).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useThreadsWithAttachmentsFrom('sender@example.com', 20),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(jmapClient.request).toHaveBeenCalledWith([
        ['Thread/query', {
          accountId: 'account-1',
          filter: {
            allOf: [
              { from: 'sender@example.com' },
              { hasAttachment: true },
            ],
          },
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 20,
          position: 0,
        }, '0'],
      ]);
    });
  });

  describe('useThreadParticipantFilterBuilder', () => {
    it('returns a function that builds filters', () => {
      const { result } = renderHook(() => useThreadParticipantFilterBuilder(), {
        wrapper: Wrapper,
      });

      expect(typeof result.current).toBe('function');

      const filter = result.current({ from: 'test@example.com' });
      expect(filter).toEqual({ from: 'test@example.com' });
    });
  });
});
