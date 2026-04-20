/**
 * RFC 8984 JMAP for JSCalendar Hooks
 * 
 * React Query hooks for JMAP Calendar operations per RFC 8984.
 * Includes Calendar and CalendarEvent methods with proper caching and optimistic updates.
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
} from '../../types/jmap-calendar';

const CALENDAR_CAPABILITY = 'urn:ietf:params:jmap:calendars';
const CALENDAR_EVENT_CAPABILITY = 'urn:ietf:params:jmap:calendarEvents';

// ============ Capability Checks ============

/**
 * Check if the server supports RFC 8984 JMAP Calendars
 */
export function hasCalendarCapability(): boolean {
  return jmapClient.hasCapability(CALENDAR_CAPABILITY);
}

/**
 * Check if the server supports RFC 8984 JMAP CalendarEvents
 */
export function hasCalendarEventCapability(): boolean {
  return jmapClient.hasCapability(CALENDAR_EVENT_CAPABILITY);
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

/**
 * Hook to check if calendar event capability is available
 */
export function useHasCalendarEventCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(hasCalendarEventCapability() && accountId);
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
    // Combine internal capability check with any external enabled option
    enabled: !!accountId && hasCalendarCapability() && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 10 * 60 * 1000, // 10 minutes
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

      // Build time range filter if start/end provided
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
        ids: null, // Get all events in calendars
      };

      const response = await jmapClient.request(
        [['CalendarEvent/get', request, '0']],
        [CALENDAR_EVENT_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventGetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendar events');
      }

      let events = methodRes[1].list;

      // Client-side filtering for complex filters not supported by server
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

      // Sort events by start time
      if (sort) {
        events = [...events].sort((a: CalendarEvent, b: CalendarEvent) => {
          const aTime = new Date(a.start).getTime();
          const bTime = new Date(b.start).getTime();
          return sort[0]?.isAscending !== false ? aTime - bTime : bTime - aTime;
        });
      } else {
        // Default sort by start time ascending
        events = [...events].sort((a: CalendarEvent, b: CalendarEvent) => 
          new Date(a.start).getTime() - new Date(b.start).getTime()
        );
      }

      // Apply limit
      if (limit && limit > 0) {
        events = events.slice(0, limit);
      }

      return events;
    },
    // Combine internal capability check with any external enabled option
    enabled: !!accountId && hasCalendarEventCapability() && (queryOptions?.enabled !== false),
    staleTime: 2 * 60 * 1000, // 2 minutes for events (more dynamic)
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
        [CALENDAR_EVENT_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventQueryResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to query calendar events');
      }

      return methodRes[1];
    },
    // Combine internal capability check with any external enabled option
    enabled: !!accountId && hasCalendarEventCapability() && (options?.enabled !== false),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
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
      
      // Check for partial failures in notCreated
      if (result.notCreated && Object.keys(result.notCreated).length > 0) {
        const firstError = Object.values(result.notCreated)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to create calendar');
      }
      
      // Check for partial failures in notUpdated
      if (result.updated) {
        const updateErrors = Object.entries(result.updated)
          .filter(([, value]) => value && typeof value === 'object' && 'type' in value)
          .map(([, value]) => value as { type: string; description?: string });
        if (updateErrors.length > 0) {
          throw new Error(updateErrors[0].description || 'Failed to update calendar');
        }
      }
      
      // Check for partial failures in notDestroyed
      if (result.destroyed) {
        const destroyErrors = Object.entries(result.destroyed)
          .filter(([, value]) => value && typeof value === 'object' && 'type' in value)
          .map(([, value]) => value as { type: string; description?: string });
        if (destroyErrors.length > 0) {
          throw new Error(destroyErrors[0].description || 'Failed to delete calendar');
        }
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate calendar queries
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
    deleteCalendar: (id: string) => 
      mutation.mutateAsync({ destroy: [id] }),
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
        [CALENDAR_EVENT_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventSetResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to update calendar events');
      }

      const result = methodRes[1];
      
      // Check for partial failures in notCreated
      if (result.notCreated && Object.keys(result.notCreated).length > 0) {
        const firstError = Object.values(result.notCreated)[0] as { type?: string; description?: string };
        throw new Error(firstError?.description || 'Failed to create event');
      }
      
      // Check for partial failures in update errors
      if (result.updated) {
        const updateErrors = Object.entries(result.updated)
          .filter(([, value]) => value && typeof value === 'object' && 'type' in value)
          .map(([, value]) => value as { type: string; description?: string });
        if (updateErrors.length > 0) {
          throw new Error(updateErrors[0].description || 'Failed to update event');
        }
      }
      
      // Check for partial failures in destroy errors
      if (result.destroyed) {
        const destroyErrors = Object.entries(result.destroyed)
          .filter(([, value]) => value && typeof value === 'object' && 'type' in value)
          .map(([, value]) => value as { type: string; description?: string });
        if (destroyErrors.length > 0) {
          throw new Error(destroyErrors[0].description || 'Failed to delete event');
        }
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate event queries
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', accountId] });
      queryClient.invalidateQueries({ queryKey: ['calendarEventQuery', accountId] });
    },
    onError: (error) => {
      logger.error('[useCalendarEventActions] CalendarEvent/set failed:', error);
    },
  });

  return {
    createEvent: (event: CalendarEventPatch) => {
      const createId = `create-${Date.now()}`;
      return mutation.mutateAsync({ create: { [createId]: event } });
    },
    updateEvent: (id: string, event: Partial<CalendarEventPatch>) => 
      mutation.mutateAsync({ update: { [id]: event } }),
    deleteEvent: (id: string) => 
      mutation.mutateAsync({ destroy: [id] }),
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
        [CALENDAR_EVENT_CAPABILITY]
      );

      const methodRes = (response as { methodResponses: [string, CalendarEventChangesResponse, string][] }).methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const error = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(error?.description || 'Failed to fetch calendar event changes');
      }

      return methodRes[1];
    },
    enabled: !!accountId && !!sinceState && hasCalendarEventCapability(),
    ...options,
  });
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
      staleTime: 60 * 1000, // 1 minute
      ...options,
      // Don't pass enabled option - let useCalendarEvents handle capability check
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
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}
