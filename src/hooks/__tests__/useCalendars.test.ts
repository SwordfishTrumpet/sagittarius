/**
 * Tests for draft-ietf-jmap-calendars-26 JMAP JSCalendar hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import {
  hasCalendarCapability,
  useHasCalendarCapability,
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
  useCalendarEventCopy,
  useCalendarEventQueryChanges,
  useCalendarEventParse,
  useHasCalendarEventParseCapability,
  useParticipantIdentities,
  useParticipantIdentityActions,
  useParticipantIdentityChanges,
  useCalendarEventNotifications,
  useCalendarEventNotificationQuery,
  useCalendarEventNotificationQueryChanges,
  useCalendarEventNotificationChanges,
  useCalendarEventNotificationActions,
  usePrincipalAvailability,
  useHasPrincipalAvailabilityCapability,
} from '../jmap/useCalendars';
import { jmapClient } from '../../api/jmap';
import type { Calendar, CalendarEvent, CalendarNotification } from '../../types/jmap-calendar';

vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getPrimaryAccount: vi.fn(),
    hasCapability: vi.fn(),
    getAccountCapability: vi.fn(),
    request: vi.fn(),
  },
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

    it('hasCalendarEventParseCapability returns true when server supports parse', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      expect(useHasCalendarEventParseCapability()).toBe(true);
    });

    it('hasPrincipalAvailabilityCapability returns true when server supports it', () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);

      const { result } = renderHook(() => useHasPrincipalAvailabilityCapability(), { wrapper: Wrapper });

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
        isVisible: true,
        includeInAvailability: 'all',
        color: '#007AFF',
        timeZone: 'America/New_York',
        shareWith: null,
        myRights: {
          mayReadFreeBusy: true,
          mayReadItems: true,
          mayWriteAll: true,
          mayWriteOwn: true,
          mayUpdatePrivate: true,
          mayRSVP: true,
          mayShare: true,
          mayDelete: true,
        },
        defaultAlertsWithTime: null,
        defaultAlertsWithoutTime: null,
      },
      {
        id: 'cal-2',
        name: 'Work',
        description: 'Work calendar',
        sortOrder: 1,
        isDefault: false,
        isSubscribed: true,
        isVisible: true,
        includeInAvailability: 'all',
        color: '#34C759',
        timeZone: null,
        shareWith: null,
        myRights: {
          mayReadFreeBusy: true,
          mayReadItems: true,
          mayWriteAll: true,
          mayWriteOwn: true,
          mayUpdatePrivate: true,
          mayRSVP: true,
          mayShare: false,
          mayDelete: false,
        },
        defaultAlertsWithTime: null,
        defaultAlertsWithoutTime: null,
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
        isVisible: true,
        includeInAvailability: 'all',
        color: '#007AFF',
        timeZone: null,
        shareWith: null,
        myRights: {
          mayReadFreeBusy: true,
          mayReadItems: true,
          mayWriteAll: true,
          mayWriteOwn: true,
          mayUpdatePrivate: true,
          mayRSVP: true,
          mayShare: true,
          mayDelete: true,
        },
        defaultAlertsWithTime: null,
        defaultAlertsWithoutTime: null,
      },
      {
        id: 'cal-2',
        name: 'Work',
        description: null,
        sortOrder: 1,
        isDefault: false,
        isSubscribed: true,
        isVisible: true,
        includeInAvailability: 'none',
        color: '#34C759',
        timeZone: null,
        shareWith: null,
        myRights: {
          mayReadFreeBusy: true,
          mayReadItems: true,
          mayWriteAll: true,
          mayWriteOwn: true,
          mayUpdatePrivate: true,
          mayRSVP: true,
          mayShare: false,
          mayDelete: false,
        },
        defaultAlertsWithTime: null,
        defaultAlertsWithoutTime: null,
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
        calendarIds: { 'cal-1': true },
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
        calendarIds: { 'cal-1': true },
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
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
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
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
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
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
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
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
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
                  isVisible: true,
                  includeInAvailability: 'all',
                  color: '#FF9500',
                  timeZone: null,
                  shareWith: null,
                  myRights: {
                    mayReadFreeBusy: true,
                    mayReadItems: true,
                    mayWriteAll: true,
                    mayWriteOwn: true,
                    mayUpdatePrivate: true,
                    mayRSVP: true,
                    mayShare: true,
                    mayDelete: true,
                  },
                  defaultAlertsWithTime: null,
                  defaultAlertsWithoutTime: null,
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
                  isVisible: true,
                  includeInAvailability: 'all',
                  color: '#007AFF',
                  timeZone: null,
                  shareWith: null,
                  myRights: {
                    mayReadFreeBusy: true,
                    mayReadItems: true,
                    mayWriteAll: true,
                    mayWriteOwn: true,
                    mayUpdatePrivate: true,
                    mayRSVP: true,
                    mayShare: true,
                    mayDelete: true,
                  },
                  defaultAlertsWithTime: null,
                  defaultAlertsWithoutTime: null,
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
                  calendarIds: { 'cal-1': true },
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
        calendarIds: { 'cal-1': true },
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
                  calendarIds: { 'cal-1': true },
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

    it('creates event with sendSchedulingMessage', async () => {
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
                  calendarIds: { 'cal-1': true },
                  uid: 'uid-new@example.com',
                  title: 'New Event with Invite',
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

      const newEvent = await result.current.createEvent(
        {
          calendarIds: { 'cal-1': true },
          title: 'New Event with Invite',
          start: '2026-04-02T14:00:00Z',
          duration: 3600,
        },
        'whenNeeded'
      );

      expect(jmapClient.request).toHaveBeenCalledWith(
        expect.arrayContaining([
          ['CalendarEvent/set', expect.objectContaining({ sendSchedulingMessage: 'whenNeeded' }), '0'],
        ]),
        ['urn:ietf:params:jmap:calendars']
      );
      expect(newEvent.created).toBeDefined();
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
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
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
          calendarIds: { 'cal-1': true },
          uid: 'uid-1@example.com',
          title: 'Morning Meeting',
          start: '2026-04-02T09:00:00Z',
          duration: 3600,
          created: '2026-04-01T08:00:00Z',
          updated: '2026-04-01T08:00:00Z',
        },
      ];

      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
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
          calendarIds: { 'cal-1': true },
          uid: 'uid-today@example.com',
          title: 'Today\'s Meeting',
          start: new Date().toISOString(),
          duration: 3600,
          created: '2026-04-01T08:00:00Z',
          updated: '2026-04-01T08:00:00Z',
        },
      ];

      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
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

  describe('useCalendarEventCopy', () => {
    it('copies events successfully', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/copy',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              copied: {
                'event-1': {
                  id: 'event-1-copy',
                  calendarIds: { 'cal-2': true },
                  uid: 'uid-copy@example.com',
                  title: 'Copied Event',
                  start: '2026-04-02T10:00:00Z',
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

      const { result } = renderHook(() => useCalendarEventCopy(), { wrapper: Wrapper });

      const copyResult = await result.current.mutateAsync({
        ids: ['event-1'],
        calendarIds: { 'event-1': { 'cal-2': true } },
      });

      expect(copyResult.copied).toBeDefined();
      expect(copyResult.copied?.['event-1']).toMatchObject({
        id: 'event-1-copy',
        title: 'Copied Event',
      });
      expect(jmapClient.request).toHaveBeenCalledWith(
        expect.arrayContaining([
          ['CalendarEvent/copy', expect.objectContaining({ ids: ['event-1'] }), '0'],
        ]),
        ['urn:ietf:params:jmap:calendars']
      );
    });
  });

  describe('useCalendarEventQueryChanges', () => {
    it('fetches query changes for calendar events', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/queryChanges',
            {
              accountId: 'account-1',
              oldQueryState: 'old-query-state',
              newQueryState: 'new-query-state',
              total: 3,
              added: [{ id: 'event-3', index: 0 }],
              removed: ['event-1'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(
        () => useCalendarEventQueryChanges({ sinceQueryState: 'old-query-state' }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.added).toEqual([{ id: 'event-3', index: 0 }]);
      expect(result.current.data?.removed).toEqual(['event-1']);
    });
  });

  describe('useCalendarEventParse', () => {
    it('parses iCalendar data into events', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEvent/parse',
            {
              accountId: 'account-1',
              parsed: {
                'blob-1': {
                  id: 'event-parsed',
                  calendarIds: {},
                  uid: 'parsed-uid@example.com',
                  title: 'Parsed Event',
                  start: '2026-04-02T10:00:00Z',
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

      const { result } = renderHook(() => useCalendarEventParse(), { wrapper: Wrapper });

      const parseResult = await result.current.mutateAsync({ blobIds: ['blob-1'] });

      expect(parseResult.parsed).toBeDefined();
      expect(parseResult.parsed?.['blob-1']).toMatchObject({ title: 'Parsed Event' });
      expect(jmapClient.request).toHaveBeenCalledWith(
        expect.arrayContaining([
          ['CalendarEvent/parse', expect.objectContaining({ blobIds: ['blob-1'] }), '0'],
        ]),
        ['urn:ietf:params:jmap:calendars', 'urn:ietf:params:jmap:calendars:parse']
      );
    });
  });

  describe('useParticipantIdentities', () => {
    it('fetches participant identities', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ParticipantIdentity/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: [
                {
                  id: 'pi-1',
                  email: 'user@example.com',
                  name: 'Test User',
                  defaultParticipationStatus: null,
                  mayInvite: true,
                  created: '2026-01-01T00:00:00Z',
                  updated: '2026-01-01T00:00:00Z',
                },
              ],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useParticipantIdentities(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].email).toBe('user@example.com');
    });
  });

  describe('useParticipantIdentityActions', () => {
    it('creates a participant identity', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ParticipantIdentity/set',
            {
              accountId: 'account-1',
              newState: 'new-state',
              created: {
                'create-123456': {
                  id: 'pi-new',
                  email: 'new@example.com',
                  name: 'New User',
                  defaultParticipationStatus: null,
                  mayInvite: true,
                  created: '2026-01-01T00:00:00Z',
                  updated: '2026-01-01T00:00:00Z',
                },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useParticipantIdentityActions(), { wrapper: Wrapper });

      const created = await result.current.createIdentity({
        email: 'new@example.com',
        name: 'New User',
      });

      expect(created.created).toBeDefined();
      expect(created.created?.['create-123456']).toMatchObject({ email: 'new@example.com' });
    });
  });

  describe('useParticipantIdentityChanges', () => {
    it('fetches participant identity changes', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'ParticipantIdentity/changes',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              hasMoreChanges: false,
              created: ['pi-3'],
              updated: ['pi-1'],
              destroyed: ['pi-2'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useParticipantIdentityChanges('old-state'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.created).toEqual(['pi-3']);
    });
  });

  describe('useCalendarEventNotifications', () => {
    it('fetches calendar event notifications', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEventNotification/get',
            {
              accountId: 'account-1',
              state: 'state-1',
              list: [
                {
                  id: 'notif-1',
                  type: 'invite',
                  summary: 'New event invitation',
                  eventId: 'event-1',
                  calendarId: 'cal-1',
                  created: '2026-04-01T08:00:00Z',
                  isRead: false,
                },
              ],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventNotifications(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].type).toBe('invite');
    });
  });

  describe('useCalendarEventNotificationQuery', () => {
    it('queries calendar event notifications', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEventNotification/query',
            {
              accountId: 'account-1',
              queryState: 'q-state-1',
              canCalculateChanges: true,
              position: 0,
              total: 2,
              ids: ['notif-1', 'notif-2'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventNotificationQuery({ isRead: false }), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.ids).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
    });
  });

  describe('useCalendarEventNotificationQueryChanges', () => {
    it('fetches query changes for notifications', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEventNotification/queryChanges',
            {
              accountId: 'account-1',
              oldQueryState: 'old-state',
              newQueryState: 'new-state',
              added: [{ id: 'notif-3', index: 0 }],
              removed: ['notif-1'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(
        () => useCalendarEventNotificationQueryChanges({ sinceQueryState: 'old-state' }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.added).toEqual([{ id: 'notif-3', index: 0 }]);
    });
  });

  describe('useCalendarEventNotificationChanges', () => {
    it('fetches notification changes', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEventNotification/changes',
            {
              accountId: 'account-1',
              oldState: 'old-state',
              newState: 'new-state',
              hasMoreChanges: false,
              created: ['notif-3'],
              updated: ['notif-1'],
              destroyed: ['notif-2'],
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventNotificationChanges('old-state'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.created).toEqual(['notif-3']);
    });
  });

  describe('useCalendarEventNotificationActions', () => {
    it('marks notification as read', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'CalendarEventNotification/set',
            {
              accountId: 'account-1',
              newState: 'new-state',
              updated: {
                'notif-1': {
                  id: 'notif-1',
                  type: 'invite',
                  summary: 'Read notification',
                  eventId: 'event-1',
                  calendarId: 'cal-1',
                  created: '2026-04-01T08:00:00Z',
                  isRead: true,
                },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(() => useCalendarEventNotificationActions(), { wrapper: Wrapper });

      const markResult = await result.current.markAsRead('notif-1');

      expect(markResult.updated).toBeDefined();
      expect(jmapClient.request).toHaveBeenCalledWith(
        expect.arrayContaining([
          ['CalendarEventNotification/set', expect.objectContaining({
            update: { 'notif-1': { isRead: true } },
          }), '0'],
        ]),
        ['urn:ietf:params:jmap:calendars']
      );
    });
  });

  describe('usePrincipalAvailability', () => {
    it('fetches principal availability', async () => {
      vi.mocked(jmapClient.getPrimaryAccount).mockReturnValue('account-1');
      vi.mocked(jmapClient.hasCapability).mockReturnValue(true);
      vi.mocked(jmapClient.request).mockResolvedValue({
        methodResponses: [
          [
            'Principal/getAvailability',
            {
              accountId: 'account-1',
              list: {
                'principal-1': {
                  id: 'principal-1',
                  busy: [
                    { start: '2026-04-02T09:00:00Z', end: '2026-04-02T10:00:00Z', status: 'busy' },
                  ],
                  isAvailable: false,
                },
              },
            },
            '0',
          ],
        ],
        sessionState: 'session-state',
      });

      const { result } = renderHook(
        () => usePrincipalAvailability({
          ids: ['principal-1'],
          start: '2026-04-02T00:00:00Z',
          end: '2026-04-02T23:59:59Z',
        }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.list['principal-1']).toBeDefined();
      expect(result.current.data?.list['principal-1'].busy).toHaveLength(1);
      expect(result.current.data?.list['principal-1'].isAvailable).toBe(false);
    });
  });
});
