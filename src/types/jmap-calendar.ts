/**
 * RFC 8984 JMAP for JSCalendar Type Definitions
 * 
 * This module defines types for the JMAP Calendar extension per RFC 8984.
 * It includes Calendar, CalendarEvent, and CalendarNotification data types with their associated
 * JMAP methods: get, changes, set, query, queryChanges.
 * 
 * JSCalendar is a JSON representation of calendar data, replacing the older iCalendar format.
 * It supports events, tasks, and journals with rich properties for scheduling.
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc8984
 */

// ============ Capability Types ============

/**
 * The account-specific calendar capability configuration.
 * Returned in accountCapabilities for urn:ietf:params:jmap:calendars
 */
export interface CalendarsCapability {
  /** Maximum number of calendars that can be created in the account */
  maxCalendarsPerAccount: number | null;
  /** Maximum size in octets for a calendar event */
  maxCalendarEventSize: number | null;
  /** Maximum number of participants allowed in one event */
  maxParticipantsPerEvent: number | null;
  /** Whether the user may create calendars in this account */
  mayCreateCalendar: boolean;
  /** Supported iCalendar RRULE parts for recurrence */
  supportedRRULEProperties: string[] | null;
}

// ============ Calendar Types ============

/**
 * Access rights for a Calendar
 */
export interface CalendarRights {
  /** The user may fetch the events in this calendar */
  mayRead: boolean;
  /** The user may create, modify, or destroy events in this calendar */
  mayWrite: boolean;
  /** The user may share the calendar with others */
  mayShare: boolean;
  /** The user may delete the calendar itself */
  mayDelete: boolean;
}

/**
 * Calendar object per RFC 8984
 * A named collection of CalendarEvents
 */
export interface Calendar {
  /** The id of the Calendar (immutable, server-set) */
  id: string;
  /** The user-visible name of the Calendar */
  name: string;
  /** An optional long-form description */
  description: string | null;
  /** Defines the sort order of calendars in the UI */
  sortOrder: number;
  /** True for exactly one calendar in an account (the default) */
  isDefault: boolean;
  /** True if the user wishes to see this calendar */
  isSubscribed: boolean;
  /** Color for displaying this calendar (hex or CSS color string) */
  color: string | null;
  /** Timezone for the calendar (if events don't specify one) */
  timeZone: string | null;
  /** Map of Principal id to rights for shared calendars */
  shareWith: Record<string, CalendarRights> | null;
  /** The set of access rights the user has for this calendar */
  myRights: CalendarRights;
}

// ============ CalendarEvent Types ============

/**
 * Participant role in an event
 */
export type ParticipantRole = 'chair' | 'req-participant' | 'opt-participant' | 'non-participant' | 'informational';

/**
 * Participant status (attendance)
 */
export type ParticipationStatus = 'needs-action' | 'accepted' | 'declined' | 'tentative' | 'delegated';

/**
 * Show/free/busy status for time blocking
 */
export type ShowStatus = 'busy' | 'free';

/**
 * Email address with optional name
 */
export interface CalendarEmailAddress {
  email: string;
  name?: string;
}

/**
 * A participant in a calendar event
 */
export interface Participant {
  /** Unique id for this participant within the event */
  id?: string;
  /** Display name of the participant */
  name?: string;
  /** Email address for the participant */
  email?: string;
  /** Whether this participant represents a group/room/resource */
  kind?: 'individual' | 'group' | 'location' | 'resource';
  /** Role of this participant */
  role?: ParticipantRole;
  /** Attendance status */
  participationStatus?: ParticipationStatus;
  /** Whether to show as busy on their calendar */
  showAs?: ShowStatus;
  /** Whether this participant is the organizer */
  isOrganizer?: boolean;
  /** For delegated participation, the delegatee */
  delegatedTo?: string[];
  /** For delegated participation, the delegator */
  delegatedFrom?: string[];
  /** Whether this participant is the current user */
  isOwn?: boolean;
  /** Additional properties for this participant */
  properties?: Record<string, unknown>;
}

/**
 * Geographic location
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Location for an event
 */
export interface Location {
  /** Unique id for this location within the event */
  id?: string;
  /** Display name of the location */
  name?: string;
  /** Detailed description */
  description?: string;
  /** Full address string */
  address?: string;
  /** Geographic coordinates */
  coordinates?: GeoLocation;
  /** Timezone at this location */
  timeZone?: string;
  /** Link to map or location info */
  url?: string;
  /** Whether this location is the main location */
  isMain?: boolean;
}

/**
 * Recurrence rule for repeating events
 */
export interface RecurrenceRule {
  /** Frequency of recurrence */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Interval between occurrences (default 1) */
  interval?: number;
  /** RFC 5545 RRULE string for complex rules */
  rrule?: string;
  /** End type for recurrence */
  until?: string; // ISO 8601 date/datetime
  /** Maximum number of occurrences */
  count?: number;
  /** Days of the week for weekly/monthly recurrence */
  byDay?: string[];
  /** Day of the month */
  byMonthDay?: number[];
  /** Month of the year */
  byMonth?: number[];
  /** Week of the year */
  byWeekNo?: number[];
  /** Position in month (for monthly rules) */
  bySetPosition?: number[];
  /** First day of the week (for weekly rules) */
  firstDayOfWeek?: 'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' | 'su';
  /** Specific dates/times to skip in the recurrence */
  skip?: string[];
}

/**
 * Link/attachment to external resources
 */
export interface Link {
  /** URL of the resource */
  href: string;
  /** Content type of the resource */
  type?: string;
  /** Size in octets */
  size?: number;
  /** Display title */
  title?: string;
  /** Relationship to the event (e.g., 'enclosure', 'icon') */
  rel?: string;
  /** Whether the link is for display or attachment */
  display?: 'inline' | 'attachment' | 'badge';
}

/**
 * Alert/notification for an event
 */
export interface Alert {
  /** Unique id for this alert within the event */
  id?: string;
  /** Type of trigger */
  trigger: {
    /** Offset from event start (negative for before) in seconds */
    offset?: number;
    /** Absolute time for the alert */
    when?: string;
    /** Use the participant's acknowledged time */
    acknowledged?: boolean;
  };
  /** Action to take when triggered */
  action: 'display' | 'email';
  /** For display actions, the notification text */
  description?: string;
  /** For email actions, who to notify */
  attendees?: string[];
  /** Whether this alert has been acknowledged */
  acknowledged?: string; // ISO 8601 timestamp
}

/**
 * Time range for an event occurrence
 */
export interface TimeRange {
  /** Start time (ISO 8601) */
  start: string;
  /** End time (ISO 8601) - omitted for duration-based events */
  end?: string;
  /** Duration in seconds (alternative to end) */
  duration?: number;
  /** Is the start time UTC (true) or local/floating (false) */
  isAllDay?: boolean;
  /** Timezone for local times */
  timeZone?: string;
}

/**
 * CalendarEvent object per RFC 8984
 * Represents a calendar event, task, or journal entry
 */
export interface CalendarEvent {
  /** The id of the event (immutable, server-set) */
  id: string;
  /** The calendar this event belongs to */
  calendarId: string;
  /** UID for iCalendar interoperability */
  uid: string;
  
  // Core properties
  /** Event title/summary */
  title: string;
  /** Detailed description (HTML allowed) */
  description?: string;
  /** Plain text description */
  descriptionContentType?: 'text/plain' | 'text/html';
  /** Short plain text summary for list views */
  summary?: string;
  
  // Time properties
  /** When this event occurs (may be multiple for recurrence exceptions) */
  timeZone?: string;
  /** Main time range for the event */
  start: string; // ISO 8601
  /** Duration in seconds, or end time in UTC/local */
  duration?: number;
  /** Explicit end time (alternative to duration) */
  end?: string; // ISO 8601
  /** Is this an all-day event */
  isAllDay?: boolean;
  /** Show as busy/free during this time */
  showAs?: ShowStatus;
  /** Whether the end time is inclusive */
  endTimeInclusive?: boolean;
  
  // Recurrence
  /** Recurrence rule for repeating events */
  recurrenceRule?: RecurrenceRule;
  /** Specific occurrence overrides (for exceptions to the rule) */
  recurrenceOverrides?: Record<string, Partial<CalendarEvent>>;
  /** Excluded occurrence ids */
  excludedRecurrenceRules?: RecurrenceRule[];
  
  // Participants
  /** Organizer of the event */
  organizer?: Participant;
  /** All participants including organizer */
  participants?: Record<string, Participant>;
  /** Participant ids invited to this event */
  participantIds?: string[];
  
  // Locations
  /** Locations for this event */
  locations?: Record<string, Location>;
  /** Main location id */
  locationId?: string;
  /** Virtual meeting URLs */
  virtualLocations?: Record<string, Link>;
  
  // Links and attachments
  /** Related external resources */
  links?: Record<string, Link>;
  /** Embedded or attached data */
  attachments?: Record<string, Link>;
  /** Per-user locale for this event */
  locale?: string;
  
  // Alerts
  /** Alerts/reminders for this event */
  alerts?: Record<string, Alert>;
  /** Whether to use default calendar alerts */
  useDefaultAlerts?: boolean;
  
  // Status and classification
  /** Event status */
  status?: 'confirmed' | 'tentative' | 'cancelled';
  /** Privacy classification */
  privacy?: 'public' | 'private' | 'secret';
  /** Priority (0-9, 0 is undefined, 1 is highest) */
  priority?: number;
  /** Sequence number for iCalendar compatibility */
  sequence?: number;
  
  // Task-specific properties (for VTODO in iCalendar)
  /** For tasks: percent complete (0-100) */
  percentComplete?: number;
  /** For tasks: estimated duration */
  estimatedDuration?: number;
  /** For tasks: due date */
  due?: string;
  
  // Server-set properties
  /** Creation timestamp */
  created: string;
  /** Last modified timestamp */
  updated: string;
  /** User who created this event */
  createdBy?: string;
  /** Method that created this event (e.g., 'import', 'creation') */
  method?: string;
}

// ============ CalendarNotification Types ============

/**
 * Calendar notification type
 */
export type NotificationType = 
  | 'invite' 
  | 'reply' 
  | 'update' 
  | 'cancel' 
  | 'refresh' 
  | 'alarm' 
  | 'comment';

/**
 * Calendar notification for shared calendar changes
 */
export interface CalendarNotification {
  /** The id of the notification (immutable, server-set) */
  id: string;
  /** Type of notification */
  type: NotificationType;
  /** User-visible summary */
  summary: string;
  /** Detailed description */
  description?: string;
  /** Related event id */
  eventId?: string;
  /** Calendar containing the event */
  calendarId?: string;
  /** When the notification was created */
  created: string;
  /** Whether the user has read this notification */
  isRead: boolean;
  /** Additional properties specific to the notification type */
  properties?: Record<string, unknown>;
}

// ============ Filter Types ============

/**
 * Filter condition for Calendar/query
 */
export interface CalendarFilterCondition {
  /** Match calendars with this id */
  id?: string;
  /** Match calendars with names containing this string */
  name?: string;
  /** Match only default calendar */
  isDefault?: boolean;
  /** Match only subscribed calendars */
  isSubscribed?: boolean;
  /** Match calendars shared with a specific principal */
  shareWith?: string;
}

/**
 * Filter operator for Calendar/query (combining conditions)
 */
export interface CalendarFilterOperator {
  /** All conditions must match */
  allOf?: CalendarFilter[];
  /** Any condition must match */
  anyOf?: CalendarFilter[];
  /** None of the conditions must match */
  noneOf?: CalendarFilter[];
}

/** Calendar filter type (condition or operator) */
export type CalendarFilter = CalendarFilterCondition | CalendarFilterOperator;

/**
 * Filter condition for CalendarEvent/query
 */
export interface CalendarEventFilterCondition {
  /** Match events in this calendar */
  inCalendar?: string;
  /** Match events with this id */
  id?: string;
  /** Match events with uid containing this string */
  uid?: string;
  /** Match events with title containing this string */
  title?: string;
  /** Match events with description containing this string */
  description?: string;
  /** Match events with summary containing this string */
  summary?: string;
  /** Match events with location name containing this string */
  location?: string;
  /** Match events starting after this time */
  after?: string;
  /** Match events starting before this time */
  before?: string;
  /** Match events overlapping this time range */
  inTimeRange?: { start: string; end: string };
  /** Match events with this participant */
  hasParticipant?: string;
  /** Match events organized by this participant */
  organizer?: string;
  /** Match events with this status */
  status?: 'confirmed' | 'tentative' | 'cancelled';
  /** Match all-day events */
  isAllDay?: boolean;
  /** Match recurring events */
  isRecurring?: boolean;
  /** Match events with alerts */
  hasAlarm?: boolean;
  /** Match events with attachments */
  hasAttachment?: boolean;
}

/**
 * Filter operator for CalendarEvent/query
 */
export interface CalendarEventFilterOperator {
  /** All conditions must match */
  allOf?: CalendarEventFilter[];
  /** Any condition must match */
  anyOf?: CalendarEventFilter[];
  /** None of the conditions must match */
  noneOf?: CalendarEventFilter[];
}

/** CalendarEvent filter type */
export type CalendarEventFilter = CalendarEventFilterCondition | CalendarEventFilterOperator;

// ============ Request/Response Types ============

/**
 * Arguments for Calendar/get
 */
export interface CalendarGetRequest {
  /** The id of the account to use */
  accountId?: string | null;
  /** The ids of the calendars to return */
  ids: string[] | null;
  /** Properties to return (null = all) */
  properties?: string[] | null;
}

/**
 * Response from Calendar/get
 */
export interface CalendarGetResponse {
  /** The account id used for the request */
  accountId: string;
  /** The state string for caching */
  state: string;
  /** The list of calendars */
  list: Calendar[];
  /** Not found ids */
  notFound?: string[];
}

/**
 * Arguments for Calendar/changes
 */
export interface CalendarChangesRequest {
  accountId?: string | null;
  /** The state to compare against */
  sinceState: string;
  /** Maximum changes to return */
  maxChanges?: number | null;
}

/**
 * Response from Calendar/changes
 */
export interface CalendarChangesResponse {
  accountId: string;
  /** Old state */
  oldState: string;
  /** New state */
  newState: string;
  /** Has more changes available */
  hasMoreChanges: boolean;
  /** Created calendar ids */
  created: string[];
  /** Updated calendar ids */
  updated: string[];
  /** Destroyed calendar ids */
  destroyed: string[];
}

/**
 * Calendar object for create/update in Calendar/set
 */
export interface CalendarPatch {
  id?: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  color?: string | null;
  timeZone?: string | null;
  shareWith?: Record<string, CalendarRights> | null;
}

/**
 * Arguments for Calendar/set
 */
export interface CalendarSetRequest {
  accountId?: string | null;
  /** If non-null, destroys all calendars not in this list */
  ifInState?: string | null;
  /** Map of creation id to CalendarPatch for new calendars */
  create?: Record<string, CalendarPatch> | null;
  /** Map of calendar id to CalendarPatch for updates */
  update?: Record<string, CalendarPatch> | null;
  /** List of calendar ids to destroy */
  destroy?: string[] | null;
}

/**
 * Response from Calendar/set
 */
export interface CalendarSetResponse {
  accountId: string;
  /** New state after changes */
  oldState?: string | null;
  newState: string;
  /** Created calendars (creation id -> Calendar or error) */
  created?: Record<string, Calendar | Error>;
  /** Updated calendars (id -> Calendar or null or error) */
  updated?: Record<string, Calendar | null | Error>;
  /** Destroyed ids (id -> null or error) */
  destroyed?: Record<string, null | Error>;
  /** Not created due to id already existing */
  notCreated?: Record<string, Error>;
}

/**
 * Arguments for Calendar/query
 */
export interface CalendarQueryRequest {
  accountId?: string | null;
  /** Filter to apply */
  filter?: CalendarFilter | null;
  /** Sort order */
  sort?: Array<{ property: string; isAscending?: boolean }> | null;
  /** Position in results */
  position?: number | null;
  /** Maximum results to return */
  limit?: number | null;
  /** Calculate total matches */
  calculateTotal?: boolean;
}

/**
 * Response from Calendar/query
 */
export interface CalendarQueryResponse {
  accountId: string;
  /** Query state for caching */
  queryState: string;
  /** Can calculate changes between states */
  canCalculateChanges: boolean;
  /** Position of first result */
  position: number;
  /** Total matches (if requested) */
  total?: number;
  /** Sorted list of ids */
  ids: string[];
  /** Sort order used */
  sort?: Array<{ property: string; isAscending?: boolean }>;
}

/**
 * Arguments for CalendarEvent/get
 */
export interface CalendarEventGetRequest {
  accountId?: string | null;
  /** Calendar ids to get events from (null = all calendars) */
  calendarIds?: string[] | null;
  /** The ids of the events to return */
  ids?: string[] | null;
  /** Properties to return */
  properties?: string[] | null;
  /** Return events with alerts only */
  hasAlarm?: boolean | null;
}

/**
 * Response from CalendarEvent/get
 */
export interface CalendarEventGetResponse {
  accountId: string;
  state: string;
  list: CalendarEvent[];
  notFound?: string[];
}

/**
 * Arguments for CalendarEvent/changes
 */
export interface CalendarEventChangesRequest {
  accountId?: string | null;
  /** Calendar ids to check for changes */
  calendarIds?: string[] | null;
  sinceState: string;
  maxChanges?: number | null;
}

/**
 * Response from CalendarEvent/changes
 */
export interface CalendarEventChangesResponse {
  accountId: string;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: string[];
  updated: string[];
  destroyed: string[];
}

/**
 * CalendarEvent object for create/update in CalendarEvent/set
 */
export interface CalendarEventPatch {
  id?: string;
  calendarId?: string;
  uid?: string;
  title?: string;
  description?: string | null;
  descriptionContentType?: 'text/plain' | 'text/html';
  start?: string;
  duration?: number;
  end?: string;
  isAllDay?: boolean;
  timeZone?: string;
  showAs?: ShowStatus;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  privacy?: 'public' | 'private' | 'secret';
  priority?: number;
  recurrenceRule?: RecurrenceRule | null;
  recurrenceOverrides?: Record<string, Partial<CalendarEvent>> | null;
  organizer?: Participant;
  participants?: Record<string, Participant>;
  participantIds?: string[];
  locations?: Record<string, Location>;
  locationId?: string;
  virtualLocations?: Record<string, Link>;
  links?: Record<string, Link>;
  attachments?: Record<string, Link>;
  alerts?: Record<string, Alert>;
  useDefaultAlerts?: boolean;
  percentComplete?: number;
  due?: string;
  estimatedDuration?: number;
}

/**
 * Arguments for CalendarEvent/set
 */
export interface CalendarEventSetRequest {
  accountId?: string | null;
  ifInState?: string | null;
  create?: Record<string, CalendarEventPatch>;
  update?: Record<string, CalendarEventPatch>;
  destroy?: string[];
}

/**
 * Response from CalendarEvent/set
 */
export interface CalendarEventSetResponse {
  accountId: string;
  oldState?: string | null;
  newState: string;
  created?: Record<string, CalendarEvent | Error>;
  updated?: Record<string, CalendarEvent | null | Error>;
  destroyed?: Record<string, null | Error>;
  notCreated?: Record<string, Error>;
}

/**
 * Arguments for CalendarEvent/query
 */
export interface CalendarEventQueryRequest {
  accountId?: string | null;
  /** Calendar ids to search (null = all calendars) */
  calendarIds?: string[] | null;
  filter?: CalendarEventFilter | null;
  sort?: Array<{ property: string; isAscending?: boolean }> | null;
  position?: number | null;
  limit?: number | null;
  calculateTotal?: boolean;
  /** Include expanded occurrences for recurring events */
  expandRecurrences?: boolean;
  /** Time range for expansion (required if expandRecurrences is true) */
  expandTimeZone?: string | null;
}

/**
 * Response from CalendarEvent/query
 */
export interface CalendarEventQueryResponse {
  accountId: string;
  queryState: string;
  canCalculateChanges: boolean;
  position: number;
  total?: number;
  ids: string[];
  sort?: Array<{ property: string; isAscending?: boolean }>;
}

// ============ Error Type ============

/**
 * JMAP method error response
 */
export interface Error {
  type: string;
  description?: string | null;
  properties?: string[] | null;
}
