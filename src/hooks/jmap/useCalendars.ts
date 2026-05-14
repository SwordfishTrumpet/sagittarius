/**
 * draft-ietf-jmap-calendars-26 JMAP for Calendars Hooks
 *
 * React Query hooks for draft-ietf-jmap-calendars JMAP Calendar operations.
 * Includes Calendar, CalendarEvent, ParticipantIdentity, CalendarEventNotification,
 * and Principal/getAvailability methods.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { jmapClient } from '../../api/jmap';
import { logger } from '../../utils/logger';
import type {
  Calendar,
  CalendarEvent,
  CalendarFilter,
  CalendarEventFilter,
  CalendarGetResponse,
  CalendarEventGetResponse,
  CalendarSetResponse,
  CalendarEventSetResponse,
  CalendarChangesResponse,
  CalendarEventChangesResponse,
  CalendarQueryResponse,
  CalendarEventQueryResponse,
  CalendarPatch,
  CalendarEventPatch,
  CalendarSetRequest,
  CalendarEventSetRequest,
  CalendarEventCopyRequest,
  CalendarEventCopyResponse,
  CalendarEventQueryChangesRequest,
  CalendarEventQueryChangesResponse,
  CalendarEventParseRequest,
  CalendarEventParseResponse,
  ParticipantIdentity,
  ParticipantIdentityGetResponse,
  ParticipantIdentityChangesResponse,
  ParticipantIdentitySetResponse,
  ParticipantIdentityPatch,
  CalendarEventNotificationFilter,
  CalendarEventNotificationQueryRequest,
  CalendarEventNotificationQueryResponse,
  CalendarEventNotificationQueryChangesRequest,
  CalendarEventNotificationQueryChangesResponse,
  CalendarEventNotificationGetResponse,
  CalendarEventNotificationChangesResponse,
  CalendarEventNotificationSetResponse,
  CalendarEventNotificationPatch,
  PrincipalGetAvailabilityRequest,
  PrincipalGetAvailabilityResponse,
  PrincipalAvailability,
} from '../../types/jmap-calendar';

const CALENDAR_CAPABILITY = 'urn:ietf:params:jmap:calendars';

// ============ Capability Checks ============

/**
 * Check if the server supports draft-ietf-jmap-calendars-26 JMAP Calendars
 */
export function hasCalendarCapability(): boolean {
  return jmapClient.hasCapability(CALENDAR_CAPABILITY);
}

/**
 * Get the calendar capability configuration
 */
export function getCalendarCapability() {
  return jmapClient.getAccountCapability(CALENDAR_CAPABILITY);
}

/**
 * Hook to check if calendar capability is available
 */
export function useHasCalendarCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(hasCalendarCapability() && accountId);
}

// ============ Calendar Hooks ============

/**
 * Hook to fetch all calendars
 */
export function useCalendars(
  options?: Omit<UseQueryOptions<Calendar[], Error, Calendar[], [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<Calendar[], Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendars', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['Calendar/get', { accountId, ids: null }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarGetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendars');
      }

      return methodRes[1].list;
    },
    enabled: !!accountId && hasCalendarCapability() && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch the default calendar
 */
export function useDefaultCalendar(
  options?: Omit<UseQueryOptions<Calendar | null, Error, Calendar | null, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<Calendar | null, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['defaultCalendar', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['Calendar/get', { accountId, ids: null }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarGetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendars');
      }

      return methodRes[1].list.find((c: Calendar) => c.isDefault) || null;
    },
    enabled: !!accountId && hasCalendarCapability(),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook to query calendars with filters
 */
export function useCalendarQuery(
  filter?: CalendarFilter,
  options?: Omit<UseQueryOptions<CalendarQueryResponse, Error, CalendarQueryResponse, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarQueryResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarQuery', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['Calendar/query', { accountId, filter: filter || null }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarQueryResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to query calendars');
      }

      return methodRes[1];
    },
    enabled: !!accountId && hasCalendarCapability(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// ============ Calendar Event Hooks ============

interface UseCalendarEventsOptions {
  calendarIds?: string[];
  filter?: CalendarEventFilter;
  sort?: Array<{ property: string; isAscending?: boolean }>;
  limit?: number;
  start?: string;
  end?: string;
}

/**
 * Hook to fetch calendar events
 */
export function useCalendarEvents(
  options: UseCalendarEventsOptions = {},
  queryOptions?: Omit<UseQueryOptions<CalendarEvent[], Error, CalendarEvent[], [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEvent[], Error> {
  const accountId = jmapClient.getPrimaryAccount();
  const { calendarIds, filter, sort, limit, start, end } = options;

  return useQuery({
    queryKey: ['calendarEvents', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      let finalFilter: CalendarEventFilter | undefined = filter;
      if (start && end) {
        const timeFilter: CalendarEventFilter = {
          inTimeRange: { start, end },
        };
        finalFilter = finalFilter
          ? { allOf: [finalFilter, timeFilter] }
          : timeFilter;
      }

      const request = {
        accountId,
        calendarIds: calendarIds || null,
        ids: null,
      };

      const response = await jmapClient.request(
        [['CalendarEvent/get', request, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventGetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendar events');
      }

      let events = methodRes[1].list;

      if (finalFilter && 'inTimeRange' in (finalFilter as Record<string, unknown>)) {
        const timeRange = (finalFilter as { inTimeRange?: { start: string; end: string } }).inTimeRange;
        if (timeRange) {
          events = events.filter((event: CalendarEvent) => {
            const eventStart = new Date(event.start);
            const rangeStart = new Date(timeRange.start);
            const rangeEnd = new Date(timeRange.end);
            return eventStart >= rangeStart && eventStart < rangeEnd;
          });
        }
      }

      if (sort) {
        events = [...events].sort((a: CalendarEvent, b: CalendarEvent) => {
          const aTime = new Date(a.start).getTime();
          const bTime = new Date(b.start).getTime();
          return sort[0]?.isAscending !== false ? aTime - bTime : bTime - aTime;
        });
      } else {
        events = [...events].sort((a: CalendarEvent, b: CalendarEvent) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
        );
      }

      if (limit && limit > 0) {
        events = events.slice(0, limit);
      }

      return events;
    },
    enabled: !!accountId && hasCalendarCapability() && (queryOptions?.enabled !== false),
    staleTime: 2 * 60 * 1000,
    ...queryOptions,
  });
}

/**
 * Hook to query calendar events with full server-side filtering
 */
export function useCalendarEventQuery(
  filter?: CalendarEventFilter,
  options?: Omit<UseQueryOptions<CalendarEventQueryResponse, Error, CalendarEventQueryResponse, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEventQueryResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarEventQuery', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEvent/query', { accountId, filter: filter || null }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventQueryResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to query calendar events');
      }

      return methodRes[1];
    },
    enabled: !!accountId && hasCalendarCapability() && (options?.enabled !== false),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

// ============ CalendarEvent/copy (draft Section 5.10) ============

/**
 * Hook for CalendarEvent/copy operation
 */
export function useCalendarEventCopy() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation({
    mutationFn: async (request: Omit<CalendarEventCopyRequest, 'accountId'>) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEvent/copy', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventCopyResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to copy calendar events');
      }

      const result = methodRes[1];

      if (result.notCopied && Object.keys(result.notCopied).length > 0) {
        const firstError = Object.values(result.notCopied)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to copy some events');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', accountId] });
      queryClient.invalidateQueries({ queryKey: ['calendarEventQuery', accountId] });
    },
    onError: (error) => {
      logger.error('[useCalendarEventCopy] CalendarEvent/copy failed:', error);
    },
  });
}

// ============ CalendarEvent/queryChanges (draft Section 5.12) ============

/**
 * Hook to get query-level changes for calendar events
 */
export function useCalendarEventQueryChanges(
  request: Omit<CalendarEventQueryChangesRequest, 'accountId'>,
  options?: Omit<UseQueryOptions<CalendarEventQueryChangesResponse, Error, CalendarEventQueryChangesResponse, [string, string | null, string]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEventQueryChangesResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarEventQueryChanges', accountId, request.sinceQueryState],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEvent/queryChanges', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventQueryChangesResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to query calendar event changes');
      }

      return methodRes[1];
    },
    enabled: !!accountId && !!request.sinceQueryState && hasCalendarCapability(),
    ...options,
  });
}

// ============ CalendarEvent/parse (draft Section 5.13) ============

/**
 * Hook for CalendarEvent/parse operation
 * Requires urn:ietf:params:jmap:calendars:parse capability
 */
export function useCalendarEventParse() {
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation({
    mutationFn: async (request: Omit<CalendarEventParseRequest, 'accountId'>) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEvent/parse', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY, 'urn:ietf:params:jmap:calendars:parse']
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventParseResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to parse calendar events');
      }

      return methodRes[1];
    },
    onError: (error) => {
      logger.error('[useCalendarEventParse] CalendarEvent/parse failed:', error);
    },
  });
}

/**
 * Check if CalendarEvent/parse is supported
 */
export function hasCalendarEventParseCapability(): boolean {
  return jmapClient.hasCapability('urn:ietf:params:jmap:calendars:parse');
}

/**
 * Hook to check if CalendarEvent/parse is available
 */
export function useHasCalendarEventParseCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(hasCalendarEventParseCapability() && accountId);
}

// ============ Calendar Mutation Hooks ============

/**
 * Hook for Calendar/set operations (create, update, delete)
 */
export function useCalendarActions() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  const mutation = useMutation({
    mutationFn: async (request: Omit<CalendarSetRequest, 'accountId'>) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['Calendar/set', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarSetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to update calendars');
      }

      const result = methodRes[1];

      if (result.notCreated && Object.keys(result.notCreated).length > 0) {
        const firstError = Object.values(result.notCreated)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to create calendar');
      }

      if (result.notUpdated && Object.keys(result.notUpdated).length > 0) {
        const firstError = Object.values(result.notUpdated)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to update calendar');
      }

      if (result.notDestroyed && Object.keys(result.notDestroyed).length > 0) {
        const firstError = Object.values(result.notDestroyed)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to delete calendar');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars', accountId] });
      queryClient.invalidateQueries({ queryKey: ['calendarQuery', accountId] });
      queryClient.invalidateQueries({ queryKey: ['defaultCalendar', accountId] });
    },
    onError: (error) => {
      logger.error('[useCalendarActions] Calendar/set failed:', error);
    },
  });

  return {
    createCalendar: (calendar: CalendarPatch) => {
      const createId = `create-${Date.now()}`;
      return mutation.mutateAsync({ create: { [createId]: calendar } });
    },
    updateCalendar: (id: string, calendar: Partial<CalendarPatch>) =>
      mutation.mutateAsync({ update: { [id]: calendar } }),
    deleteCalendar: (id: string, onDestroyRemoveEvents?: boolean) =>
      mutation.mutateAsync({ destroy: [id], onDestroyRemoveEvents }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============ Calendar Event Mutation Hooks ============

/**
 * Hook for CalendarEvent/set operations (create, update, delete)
 */
export function useCalendarEventActions() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  const mutation = useMutation({
    mutationFn: async (request: Omit<CalendarEventSetRequest, 'accountId'>) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEvent/set', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventSetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to update calendar events');
      }

      const result = methodRes[1];

      if (result.notCreated && Object.keys(result.notCreated).length > 0) {
        const firstError = Object.values(result.notCreated)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to create event');
      }

      if (result.notUpdated && Object.keys(result.notUpdated).length > 0) {
        const firstError = Object.values(result.notUpdated)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to update event');
      }

      if (result.notDestroyed && Object.keys(result.notDestroyed).length > 0) {
        const firstError = Object.values(result.notDestroyed)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to delete event');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', accountId] });
      queryClient.invalidateQueries({ queryKey: ['calendarEventQuery', accountId] });
    },
    onError: (error) => {
      logger.error('[useCalendarEventActions] CalendarEvent/set failed:', error);
    },
  });

  return {
    createEvent: (event: CalendarEventPatch, sendSchedulingMessage?: 'whenNeeded' | 'always' | 'never') => {
      const createId = `create-${Date.now()}`;
      return mutation.mutateAsync({
        create: { [createId]: event },
        ...(sendSchedulingMessage ? { sendSchedulingMessage } : {}),
      });
    },
    updateEvent: (id: string, event: Partial<CalendarEventPatch>, sendSchedulingMessage?: 'whenNeeded' | 'always' | 'never') =>
      mutation.mutateAsync({
        update: { [id]: event },
        ...(sendSchedulingMessage ? { sendSchedulingMessage } : {}),
      }),
    deleteEvent: (id: string, sendSchedulingMessage?: 'whenNeeded' | 'always' | 'never') =>
      mutation.mutateAsync({
        destroy: [id],
        ...(sendSchedulingMessage ? { sendSchedulingMessage } : {}),
      }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============ Calendar Changes Hooks ============

/**
 * Hook to fetch calendar changes since a state
 */
export function useCalendarChanges(
  sinceState: string,
  options?: Omit<UseQueryOptions<CalendarChangesResponse, Error, CalendarChangesResponse, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarChangesResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarChanges', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['Calendar/changes', { accountId, sinceState }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarChangesResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendar changes');
      }

      return methodRes[1];
    },
    enabled: !!accountId && !!sinceState && hasCalendarCapability(),
    ...options,
  });
}

/**
 * Hook to fetch calendar event changes since a state
 */
export function useCalendarEventChanges(
  sinceState: string,
  calendarIds?: string[],
  options?: Omit<UseQueryOptions<CalendarEventChangesResponse, Error, CalendarEventChangesResponse, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEventChangesResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarEventChanges', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEvent/changes', { accountId, sinceState, calendarIds: calendarIds || null }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventChangesResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendar event changes');
      }

      return methodRes[1];
    },
    enabled: !!accountId && !!sinceState && hasCalendarCapability(),
    ...options,
  });
}

// ============ ParticipantIdentity Hooks (draft Section 3) ============

/**
 * Hook to fetch participant identities
 */
export function useParticipantIdentities(
  ids?: string[] | null,
  options?: Omit<UseQueryOptions<ParticipantIdentity[], Error, ParticipantIdentity[], [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<ParticipantIdentity[], Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['participantIdentities', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['ParticipantIdentity/get', { accountId, ids: ids || null }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, ParticipantIdentityGetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch participant identities');
      }

      return methodRes[1].list;
    },
    enabled: !!accountId && hasCalendarCapability() && (options?.enabled !== false),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook for ParticipantIdentity/set operations
 */
export function useParticipantIdentityActions() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  const mutation = useMutation({
    mutationFn: async (request: {
      create?: Record<string, ParticipantIdentityPatch>;
      update?: Record<string, ParticipantIdentityPatch>;
      destroy?: string[];
    }) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['ParticipantIdentity/set', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, ParticipantIdentitySetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to update participant identities');
      }

      return methodRes[1];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantIdentities', accountId] });
    },
    onError: (error) => {
      logger.error('[useParticipantIdentityActions] ParticipantIdentity/set failed:', error);
    },
  });

  return {
    createIdentity: (identity: ParticipantIdentityPatch) => {
      const createId = `create-${Date.now()}`;
      return mutation.mutateAsync({ create: { [createId]: identity } });
    },
    updateIdentity: (id: string, identity: ParticipantIdentityPatch) =>
      mutation.mutateAsync({ update: { [id]: identity } }),
    deleteIdentity: (id: string) =>
      mutation.mutateAsync({ destroy: [id] }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to fetch participant identity changes
 */
export function useParticipantIdentityChanges(
  sinceState: string,
  options?: Omit<UseQueryOptions<ParticipantIdentityChangesResponse, Error, ParticipantIdentityChangesResponse, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<ParticipantIdentityChangesResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['participantIdentityChanges', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['ParticipantIdentity/changes', { accountId, sinceState }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, ParticipantIdentityChangesResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch participant identity changes');
      }

      return methodRes[1];
    },
    enabled: !!accountId && !!sinceState && hasCalendarCapability(),
    ...options,
  });
}

// ============ CalendarEventNotification Hooks (draft Section 7) ============

/**
 * Hook to fetch calendar event notifications
 */
export function useCalendarEventNotifications(
  ids?: string[] | null,
  options?: Omit<UseQueryOptions<CalendarNotification[], Error, CalendarNotification[], [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarNotification[], Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarEventNotifications', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEventNotification/get', { accountId, ids: ids || null }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventNotificationGetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendar event notifications');
      }

      return methodRes[1].list;
    },
    enabled: !!accountId && hasCalendarCapability() && (options?.enabled !== false),
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Hook to query calendar event notifications (draft Section 7.4)
 */
export function useCalendarEventNotificationQuery(
  filter?: CalendarEventNotificationFilter,
  options?: Omit<UseQueryOptions<CalendarEventNotificationQueryResponse, Error, CalendarEventNotificationQueryResponse, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEventNotificationQueryResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarEventNotificationQuery', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const request: CalendarEventNotificationQueryRequest = {
        accountId,
        filter: filter || null,
      };

      const response = await jmapClient.request(
        [['CalendarEventNotification/query', request, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventNotificationQueryResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to query calendar event notifications');
      }

      return methodRes[1];
    },
    enabled: !!accountId && hasCalendarCapability(),
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Hook to get query-level changes for calendar event notifications (draft Section 7.5)
 */
export function useCalendarEventNotificationQueryChanges(
  request: Omit<CalendarEventNotificationQueryChangesRequest, 'accountId'>,
  options?: Omit<UseQueryOptions<CalendarEventNotificationQueryChangesResponse, Error, CalendarEventNotificationQueryChangesResponse, [string, string | null, string]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEventNotificationQueryChangesResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarEventNotificationQueryChanges', accountId, request.sinceQueryState],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEventNotification/queryChanges', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventNotificationQueryChangesResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to query calendar event notification changes');
      }

      return methodRes[1];
    },
    enabled: !!accountId && !!request.sinceQueryState && hasCalendarCapability(),
    ...options,
  });
}

/**
 * Hook to fetch calendar event notification changes
 */
export function useCalendarEventNotificationChanges(
  sinceState: string,
  options?: Omit<UseQueryOptions<CalendarEventNotificationChangesResponse, Error, CalendarEventNotificationChangesResponse, [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEventNotificationChangesResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['calendarEventNotificationChanges', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEventNotification/changes', { accountId, sinceState }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventNotificationChangesResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendar event notification changes');
      }

      return methodRes[1];
    },
    enabled: !!accountId && !!sinceState && hasCalendarCapability(),
    ...options,
  });
}

/**
 * Hook for CalendarEventNotification/set operations
 */
export function useCalendarEventNotificationActions() {
  const queryClient = useQueryClient();
  const accountId = jmapClient.getPrimaryAccount();

  const mutation = useMutation({
    mutationFn: async (request: {
      update?: Record<string, CalendarEventNotificationPatch>;
      destroy?: string[];
    }) => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['CalendarEventNotification/set', { accountId, ...request }, '0']],
        [CALENDAR_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventNotificationSetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to update notification');
      }

      return methodRes[1];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEventNotifications', accountId] });
      queryClient.invalidateQueries({ queryKey: ['calendarEventNotificationQuery', accountId] });
    },
    onError: (error) => {
      logger.error('[useCalendarEventNotificationActions] CalendarEventNotification/set failed:', error);
    },
  });

  return {
    markAsRead: (id: string) =>
      mutation.mutateAsync({ update: { [id]: { isRead: true } } }),
    markAsUnread: (id: string) =>
      mutation.mutateAsync({ update: { [id]: { isRead: false } } }),
    deleteNotification: (id: string) =>
      mutation.mutateAsync({ destroy: [id] }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============ Principal/getAvailability (draft Section 2.2) ============

/**
 * Hook for Principal/getAvailability
 * Requires urn:ietf:params:jmap:principals:availability capability
 */
export function usePrincipalAvailability(
  request: Omit<PrincipalGetAvailabilityRequest, 'accountId'>,
  options?: Omit<UseQueryOptions<PrincipalGetAvailabilityResponse, Error, PrincipalGetAvailabilityResponse, [string, string | null, string, string]>, 'queryKey' | 'queryFn'>
): UseQueryResult<PrincipalGetAvailabilityResponse, Error> {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['principalAvailability', accountId, request.start, request.end],
    queryFn: async () => {
      if (!accountId) throw new Error('No account available');

      const response = await jmapClient.request(
        [['Principal/getAvailability', { accountId, ...request }, '0']],
        ['urn:ietf:params:jmap:principals:availability']
      );

      const methodRes = (response as { methodResponses: [string, PrincipalGetAvailabilityResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to get principal availability');
      }

      return methodRes[1];
    },
    enabled: !!accountId && request.ids.length > 0 && !!request.start && !!request.end &&
      hasPrincipalAvailabilityCapability(),
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Check if Principal/getAvailability is supported
 */
export function hasPrincipalAvailabilityCapability(): boolean {
  return jmapClient.hasCapability('urn:ietf:params:jmap:principals:availability');
}

/**
 * Hook to check if Principal/getAvailability is available
 */
export function useHasPrincipalAvailabilityCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(hasPrincipalAvailabilityCapability() && accountId);
}

// ============ Utility Hooks ============

/**
 * Hook to get events for a specific date range (convenience wrapper)
 */
export function useEventsInRange(
  start: string,
  end: string,
  calendarIds?: string[],
  options?: Omit<UseQueryOptions<CalendarEvent[], Error, CalendarEvent[], [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEvent[], Error> {
  return useCalendarEvents(
    { calendarIds, start, end },
    {
      staleTime: 60 * 1000,
      ...options,
    }
  );
}

/**
 * Hook to get today's events
 */
export function useTodaysEvents(
  calendarIds?: string[],
  options?: Omit<UseQueryOptions<CalendarEvent[], Error, CalendarEvent[], [string, string | null]>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarEvent[], Error> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  return useEventsInRange(start, end, calendarIds, {
    staleTime: 60 * 1000,
    ...options,
  });
}
