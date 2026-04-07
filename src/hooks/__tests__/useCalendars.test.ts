/**
 * Tests for RFC 8984 JMAP JSCalendar hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import {
  hasCalendarCapability,
  hasCalendarEventCapability,
  useHasCalendarCapability,
  useHasCalendarEventCapability,
  useCalendars,
  useDefaultCalendar,
  useCalendarQuery,
  useCalendarEvents,
  useCalendarEventQuery,
  useCalendarActions,
  useCalendarEventActions,
  useCalendarChanges,
  useCalendarEventChanges,
  useEventsInRange,
  useTodaysEvents,
} from '../jmap/useCalendars';
import { jmapClient } from '../../api/jmap';
import type { Calendar, CalendarEvent } from '../../types/jmap-calendar';

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

describe('useCalendars hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Capability checking', () => {
    it('hasCalendarCapability returns true when server supports calendars', () => {
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      expect(hasCalendarCapability()).toBe(true);
      expect(jmapClient.hasCapability).toHaveBeenCalledWith('urn:ietf:params:jmap:calendars');
    });

    it('hasCalendarCapability returns false when server does not support calendars', () => {
      vi.mocked(jmapClient.hasCapability).mockReturnValue(false);

      expect(hasCalendarCapability()).toBe(false);
    });

    it('hasCalendarEventCapability returns true when server supports calendar events', () => {
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      expect(hasCalendarEventCapability()).toBe(true);
      expect(jmapClient.hasCapability).toHaveBeenCalledWith('urn:ietf:params:jmap:calendarEvents');
    });

    it('useHasCalendarCapability returns true when capability is available', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      const { result } = renderHook(() => useHasCalendarCapability(), { wrapper: Wrapper });

      expect(result.current).toBe(true);
    });

    it('useHasCalendarCapability returns false when no account', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue(null);

      const { result } = renderHook(() => useHasCalendarCapability(), { wrapper: Wrapper });

      expect(result.current).toBe(false);
    });

    it('useHasCalendarEventCapability returns true when both account and capability available', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) => 
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );

      const { result } = renderHook(() => useHasCalendarEventCapability(), { wrapper: Wrapper });

      expect(result.current).toBe(true);
    });
  });

  describe('useCalendars', () => {
    const mockCalendars: Calendar[] = [
      {
        id: 'cal-1',
        name: 'Personal',
        description: null,
        sortOrder: 0,
        isDefault: true,
        isSubscribed: true,
        color: '#007AFF',
        timeZone: 'America/New_York',
        shareWith: null,
        myRights: {
          mayRead: true,
          mayWrite: true,
          mayShare: true,
          mayDelete: true,
        },
      },
      {
        id: 'cal-2',
        name: 'Work',
        description: 'Work calendar',
        sortOrder: 1,
        isDefault: false,
        isSubscribed: true,
        color: '#34C759',
        timeZone: null,
        shareWith: null,
        myRights: {
          mayRead: true,
          mayWrite: true,
          mayShare: false,
          mayDelete: false,
        },
      },
    ];

    it('fetches calendars successfully', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockCalendars,
              notFound: [],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendars(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockCalendars);
      expect(jmapClient.request).toHaveBeenCalledWith(
        [['Calendar/get', { accountId: 'account-1', ids: null }, '0']],
        ['urn:ietf:params:jmap:calendars']
      );
    });

    it('returns empty array when no calendars', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: [],
              notFound: [],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendars(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('is disabled when no account', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue(null);

      const { result } = renderHook(() => useCalendars(), { wrapper: Wrapper });

      expect(result.current.isPending).toBe(true);
    });

    it('handles error response', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          ['error', { type: 'notFound', description: 'Account not found' }, '0'],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendars(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toContain('Account not found');
    });
  });

  describe('useDefaultCalendar', () => {
    const mockCalendars: Calendar[] = [
      {
        id: 'cal-1',
        name: 'Personal',
        description: null,
        sortOrder: 0,
        isDefault: true,
        isSubscribed: true,
        color: '#007AFF',
        timeZone: null,
        shareWith: null,
        myRights: { mayRead: true, mayWrite: true, mayShare: true, mayDelete: true },
      },
      {
        id: 'cal-2',
        name: 'Work',
        description: null,
        sortOrder: 1,
        isDefault: false,
        isSubscribed: true,
        color: '#34C759',
        timeZone: null,
        shareWith: null,
        myRights: { mayRead: true, mayWrite: true, mayShare: false, mayDelete: false },
      },
    ];

    it('returns the default calendar', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockCalendars,
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useDefaultCalendar(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockCalendars[0]);
      expect(result.current.data?.isDefault).toBe(true);
    });

    it('returns null when no default calendar', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: [],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useDefaultCalendar(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });
  });

  describe('useCalendarQuery', () => {
    it('queries calendars with filter', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/query',
            {
              accountId: 'account-1',
              queryState: 'query-state-1',
              canCalculateChanges: true,
              position: 0,
              total: 2,
              ids: ['cal-1', 'cal-2'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const filter = { isSubscribed: true };
      const { result } = renderHook(() => useCalendarQuery(filter), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.ids).toEqual(['cal-1', 'cal-2']);
      expect(result.current.data?.total).toBe(2);
      expect(jmapClient.request).toHaveBeenCalledWith(
        [['Calendar/query', { accountId: 'account-1', filter }, '0']],
        ['urn:ietf:params:jmap:calendars']
      );
    });
  });

  describe('useCalendarEvents', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: 'event-1',
        calendarId: 'cal-1',
        uid: 'uid-1@example.com',
        title: 'Team Meeting',
        start: '2026-04-02T10:00:00Z',
        duration: 3600,
        isAllDay: false,
        status: 'confirmed',
        created: '2026-04-01T08:00:00Z',
        updated: '2026-04-01T08:00:00Z',
      },
      {
        id: 'event-2',
        calendarId: 'cal-1',
        uid: 'uid-2@example.com',
        title: 'Lunch Break',
        start: '2026-04-02T12:00:00Z',
        duration: 3600,
        isAllDay: false,
        status: 'confirmed',
        created: '2026-04-01T08:00:00Z',
        updated: '2026-04-01T08:00:00Z',
      },
    ];

    it('fetches calendar events', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) =>
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockEvents,
              notFound: [],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEvents(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].title).toBe('Team Meeting');
    });

    it('filters events by time range', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) =>
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockEvents,
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const start = '2026-04-02T00:00:00Z';
      const end = '2026-04-02T23:59:59Z';
      const { result } = renderHook(
        () => useCalendarEvents({ start, end }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('limits number of events returned', async () => {
      const manyEvents = Array.from({ length: 10 }, (_, i) => ({
        ...mockEvents[0],
        id: `event-${i}`,
        uid: `uid-${i}@example.com`,
        title: `Event ${i}`,
        start: new Date(Date.now() + i * 3600000).toISOString(),
        created: '2026-04-01T08:00:00Z',
        updated: '2026-04-01T08:00:00Z',
      }));

      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) =>
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: manyEvents,
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(
        () => useCalendarEvents({ limit: 5 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(5);
    });
  });

  describe('useCalendarEventQuery', () => {
    it('queries calendar events with filter', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) =>
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/query',
            {
              accountId: 'account-1',
              queryState: 'query-state-1',
              canCalculateChanges: true,
              position: 0,
              total: 5,
              ids: ['event-1', 'event-2', 'event-3', 'event-4', 'event-5'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const filter = { status: 'confirmed' as const };
      const { result } = renderHook(() => useCalendarEventQuery(filter), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.ids).toHaveLength(5);
      expect(result.current.data?.total).toBe(5);
    });
  });

  describe('useCalendarActions', () => {
    it('creates a calendar successfully', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/set',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              created: {
                'create-123456': {
                  id: 'cal-new',
                  name: 'New Calendar',
                  description: null,
                  sortOrder: 0,
                  isDefault: false,
                  isSubscribed: true,
                  color: '#FF9500',
                  timeZone: null,
                  shareWith: null,
                  myRights: { mayRead: true, mayWrite: true, mayShare: true, mayDelete: true },
                },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarActions(), { wrapper: Wrapper });

      const newCalendar = await result.current.createCalendar({
        name: 'New Calendar',
        color: '#FF9500',
      });

      expect(newCalendar.created).toBeDefined();
      expect(newCalendar.created?.['create-123456']).toMatchObject({
        id: 'cal-new',
        name: 'New Calendar',
      });
    });

    it('updates a calendar', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/set',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              updated: {
                'cal-1': {
                  id: 'cal-1',
                  name: 'Updated Calendar',
                  description: null,
                  sortOrder: 0,
                  isDefault: true,
                  isSubscribed: true,
                  color: '#007AFF',
                  timeZone: null,
                  shareWith: null,
                  myRights: { mayRead: true, mayWrite: true, mayShare: true, mayDelete: true },
                },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarActions(), { wrapper: Wrapper });

      const updateResult = await result.current.updateCalendar('cal-1', { name: 'Updated Calendar' });

      expect(updateResult.updated?.['cal-1']).toBeDefined();
      expect((updateResult.updated?.['cal-1'] as Calendar)?.name).toBe('Updated Calendar');
    });

    it('deletes a calendar', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/set',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              destroyed: { 'cal-2': null },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarActions(), { wrapper: Wrapper });

      const deleteResult = await result.current.deleteCalendar('cal-2');

      expect(deleteResult.destroyed?.['cal-2']).toBeNull();
    });

    it('handles error during create', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/set',
            {
              accountId: 'account-1',
              newState: 'new-state',
              notCreated: {
                'create-123456': { type: 'invalidArguments', description: 'Invalid calendar name' },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarActions(), { wrapper: Wrapper });

      // Should throw when there are creation errors
      await expect(result.current.createCalendar({ name: '' })).rejects.toThrow();
    });
  });

  describe('useCalendarEventActions', () => {
    it('creates an event successfully', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/set',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              created: {
                'create-123456': {
                  id: 'event-new',
                  calendarId: 'cal-1',
                  uid: 'uid-new@example.com',
                  title: 'New Event',
                  start: '2026-04-02T14:00:00Z',
                  duration: 3600,
                  created: '2026-04-01T08:00:00Z',
                  updated: '2026-04-01T08:00:00Z',
                },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventActions(), { wrapper: Wrapper });

      const newEvent = await result.current.createEvent({
        calendarId: 'cal-1',
        title: 'New Event',
        start: '2026-04-02T14:00:00Z',
        duration: 3600,
      });

      expect(newEvent.created).toBeDefined();
      expect(newEvent.created?.['create-123456']).toMatchObject({
        id: 'event-new',
        title: 'New Event',
      });
    });

    it('updates an event', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/set',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              updated: {
                'event-1': {
                  id: 'event-1',
                  calendarId: 'cal-1',
                  uid: 'uid-1@example.com',
                  title: 'Updated Event Title',
                  start: '2026-04-02T10:00:00Z',
                  duration: 3600,
                  created: '2026-04-01T08:00:00Z',
                  updated: '2026-04-02T09:00:00Z',
                },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventActions(), { wrapper: Wrapper });

      const updateResult = await result.current.updateEvent('event-1', { title: 'Updated Event Title' });

      expect(updateResult.updated?.['event-1']).toBeDefined();
      expect((updateResult.updated?.['event-1'] as CalendarEvent)?.title).toBe('Updated Event Title');
    });

    it('deletes an event', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/set',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              destroyed: { 'event-1': null },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventActions(), { wrapper: Wrapper });

      const deleteResult = await result.current.deleteEvent('event-1');

      expect(deleteResult.destroyed?.['event-1']).toBeNull();
    });
  });

  describe('useCalendarChanges', () => {
    it('fetches calendar changes', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Calendar/changes',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              hasMoreChanges: false,
              created: ['cal-3'],
              updated: ['cal-1'],
              destroyed: ['cal-2'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarChanges('old-state'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.created).toEqual(['cal-3']);
      expect(result.current.data?.updated).toEqual(['cal-1']);
      expect(result.current.data?.destroyed).toEqual(['cal-2']);
    });

    it('is disabled when no sinceState provided', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');

      const { result } = renderHook(() => useCalendarChanges(''), { wrapper: Wrapper });

      expect(result.current.isPending).toBe(true);
    });
  });

  describe('useCalendarEventChanges', () => {
    it('fetches calendar event changes', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) =>
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/changes',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              hasMoreChanges: false,
              created: ['event-3'],
              updated: ['event-1'],
              destroyed: ['event-2'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventChanges('old-state', ['cal-1']), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.created).toEqual(['event-3']);
    });
  });

  describe('useEventsInRange', () => {
    it('fetches events in a specific date range', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          calendarId: 'cal-1',
          uid: 'uid-1@example.com',
          title: 'Morning Meeting',
          start: '2026-04-02T09:00:00Z',
          duration: 3600,
          created: '2026-04-01T08:00:00Z',
          updated: '2026-04-01T08:00:00Z',
        },
      ];

      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) =>
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockEvents,
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const start = '2026-04-02T00:00:00Z';
      const end = '2026-04-02T23:59:59Z';
      const { result } = renderHook(() => useEventsInRange(start, end), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
    });
  });

  describe('useTodaysEvents', () => {
    it('fetches today\'s events', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-today',
          calendarId: 'cal-1',
          uid: 'uid-today@example.com',
          title: 'Today\'s Meeting',
          start: new Date().toISOString(),
          duration: 3600,
          created: '2026-04-01T08:00:00Z',
          updated: '2026-04-01T08:00:00Z',
        },
      ];

      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockImplementation((urn: string) =>
        urn === 'urn:ietf:params:jmap:calendarEvents'
      );
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: mockEvents,
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useTodaysEvents(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });
  });
});
