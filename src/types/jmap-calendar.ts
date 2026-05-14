/**
 * draft-ietf-jmap-calendars-26 JMAP for Calendars Type Definitions
 *
 * This module defines types for the JMAP Calendar extension per draft-ietf-jmap-calendars-26.
 * The companion data format specification is RFC 8984 (JSCalendar).
 * It includes Calendar, CalendarEvent, ParticipantIdentity, CalendarEventNotification,
 * and CalendarPrincipal data types with their associated JMAP methods.
 *
 * @see https://datatracker.ietf.org/doc/draft-ietf-jmap-calendars/
 */

// ============ Capability Types ============

/**
 * The account-specific calendar capability configuration.
 * Returned in accountCapabilities for urn:ietf:params:jmap:calendars
 * Defined in draft Section 1.5.1
 */
export interface CalendarsCapability {
  /** Maximum number of calendars per event */
  maxCalendarsPerEvent: number | null;
  /** Maximum number of participants allowed in one event */
  maxParticipantsPerEvent: number | null;
  /** Whether the user may create calendars in this account */
  mayCreateCalendar: boolean;
  /** Earliest date/time that can be used in the system */
  minDateTime: string | null;
  /** Latest date/time that can be used in the system */
  maxDateTime: string | null;
  /** Maximum duration that can be queried with expandRecurrences */
  maxExpandedQueryDuration: string | null;
}

// ============ Calendar Types ============

/**
 * Access rights for a Calendar
 * Defined in draft Section 4
 */
export interface CalendarRights {
  /** The user may fetch free/busy information for this calendar */
  mayReadFreeBusy: boolean;
  /** The user may fetch the events in this calendar */
  mayReadItems: boolean;
  /** The user may create, update, or destroy all events in this calendar */
  mayWriteAll: boolean;
  /** The user may create events and update/destroy only events they created */
  mayWriteOwn: boolean;
  /** The user may update private events in this calendar */
  mayUpdatePrivate: boolean;
  /** The user may RSVP on events inviting their mailbox */
  mayRSVP: boolean;
  /** The user may share the calendar with others */
  mayShare: boolean;
  /** The user may delete the calendar itself */
  mayDelete: boolean;
}

/**
 * Calendar object per draft Section 4
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
  /** Whether the calendar events are visible in free/busy time displays */
  isVisible: boolean;
  /** Which events are included in free/busy calculations */
  includeInAvailability: 'all' | 'attending' | 'none';
  /** Color for displaying this calendar (hex or CSS color string) */
  color: string | null;
  /** Timezone for the calendar (if events don't specify one) */
  timeZone: string | null;
  /** Map of Principal id to rights for shared calendars */
  shareWith: Record<string, CalendarRights> | null;
  /** The set of access rights the user has for this calendar */
  myRights: CalendarRights;
  /** Default alerts for events with a time */
  defaultAlertsWithTime: Record<string, Alert> | null;
  /** Default alerts for events without a time */
  defaultAlertsWithoutTime: Record<string, Alert> | null;
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
 * Free/busy status filter
 */
export type FreeBusyStatus = 'free' | 'busy' | 'tentative' | 'unavailable';

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
  /** Sequence number for scheduling message tracking */
  scheduleSequence?: number;
  /** When the scheduling message was last updated */
  scheduleUpdated?: string;
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
  until?: string;
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
 * Per draft Section 6
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
  acknowledged?: string;
  /** If set, the alert is snoozed until this time */
  snoozedUntil?: string;
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
 * CalendarEvent object per draft-ietf-jmap-calendars-26 Section 5
 * Represents a calendar event
 */
export interface CalendarEvent {
  /** The id of the event (immutable, server-set) */
  id: string;
  /** The calendars this event belongs to (map of calendarId -> true) */
  calendarIds: Record<string, boolean>;
  /** UID for iCalendar interoperability */
  uid: string;

  // Core properties
  /** Event title */
  title: string;
  /** Detailed description (HTML allowed) */
  description?: string;
  /** Content type of description */
  descriptionContentType?: 'text/plain' | 'text/html';

  // Time properties
  /** Timezone for the event */
  timeZone?: string;
  /** Main time range for the event */
  start: string;
  /** Duration in seconds */
  duration?: number;
  /** Explicit end time (alternative to duration) */
  end?: string;
  /** Is this an all-day event */
  isAllDay?: boolean;
  /** Show as busy/free during this time */
  showAs?: ShowStatus;

  // Server-set time properties
  /** Server-calculated UTC start time */
  utcStart?: string;
  /** Server-calculated UTC end time */
  utcEnd?: string;

  // Recurrence
  /** Recurrence rule for repeating events */
  recurrenceRule?: RecurrenceRule;
  /** Specific occurrence overrides (for exceptions to the rule) */
  recurrenceOverrides?: Record<string, Partial<CalendarEvent>>;
  /** Excluded recurrence rules */
  excludedRecurrenceRules?: RecurrenceRule[];
  /** For split/override events, the original event this relates to */
  relatedTo?: { type?: string; id: string } | null;

  // Participants
  /** Whether participants may invite themselves */
  mayInviteSelf?: boolean;
  /** Whether participants may invite others */
  mayInviteOthers?: boolean;
  /** Whether to hide attendees from each other */
  hideAttendees?: boolean;
  /** Organizer of the event */
  organizer?: Participant;
  /** All participants including organizer */
  participants?: Record<string, Participant>;
  /** Locations for this event */
  locations?: Record<string, Location>;
  /** Virtual meeting URLs */
  virtualLocations?: Record<string, Link>;

  // Server-set references
  /** The base event id for occurrences of a recurring event */
  baseEventId?: string | null;
  /** Whether this is a draft (unpublished) event */
  isDraft?: boolean;
  /** Whether this is the origin event in a split */
  isOrigin?: boolean;
  /** The blob id for the iCalendar representation */
  blobId?: string | null;

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

  // Task-specific properties
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

// ============ ParticipantIdentity Types ============

/**
 * ParticipantIdentity object per draft Section 3
 * Represents a mailbox (email address) that can be invited to events
 */
export interface ParticipantIdentity {
  /** The id of the identity (immutable, server-set) */
  id: string;
  /** The email address for this participant identity */
  email: string;
  /** Display name for this identity */
  name: string | null;
  /** Map of calendar id to default participation status */
  defaultParticipationStatus: Record<string, ParticipationStatus> | null;
  /** Whether this identity may be used to invite others */
  mayInvite: boolean;
  /** When this identity was created */
  created: string;
  /** When this identity was last updated */
  updated: string;
}

/**
 * Arguments for ParticipantIdentity/get
 */
export interface ParticipantIdentityGetRequest {
  accountId?: string | null;
  ids: string[] | null;
  properties?: string[] | null;
}

/**
 * Response from ParticipantIdentity/get
 */
export interface ParticipantIdentityGetResponse {
  accountId: string;
  state: string;
  list: ParticipantIdentity[];
  notFound?: string[];
}

/**
 * Arguments for ParticipantIdentity/changes
 */
export interface ParticipantIdentityChangesRequest {
  accountId?: string | null;
  sinceState: string;
  maxChanges?: number | null;
}

/**
 * Response from ParticipantIdentity/changes
 */
export interface ParticipantIdentityChangesResponse {
  accountId: string;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: string[];
  updated: string[];
  destroyed: string[];
}

/**
 * Patch object for ParticipantIdentity/set
 */
export interface ParticipantIdentityPatch {
  email?: string;
  name?: string | null;
  defaultParticipationStatus?: Record<string, ParticipationStatus> | null;
}

/**
 * Arguments for ParticipantIdentity/set
 */
export interface ParticipantIdentitySetRequest {
  accountId?: string | null;
  ifInState?: string | null;
  create?: Record<string, ParticipantIdentityPatch> | null;
  update?: Record<string, ParticipantIdentityPatch> | null;
  destroy?: string[] | null;
}

/**
 * Response from ParticipantIdentity/set
 */
export interface ParticipantIdentitySetResponse {
  accountId: string;
  oldState?: string | null;
  newState: string;
  created?: Record<string, ParticipantIdentity | Error>;
  updated?: Record<string, ParticipantIdentity | null | Error>;
  destroyed?: Record<string, null | Error>;
  notCreated?: Record<string, Error>;
  notUpdated?: Record<string, Error>;
  notDestroyed?: Record<string, Error>;
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
 * Per draft Section 4
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
  /** Match only visible calendars */
  isVisible?: boolean;
  /** Match calendars by includeInAvailability value */
  includeInAvailability?: 'all' | 'attending' | 'none';
  /** Match calendars shared with a specific principal */
  shareWith?: string;
  /** Match calendars shared by a specific principal */
  principalId?: string;
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
 * Per draft Section 5.11.1
 */
export interface CalendarEventFilterCondition {
  /** Match events in this calendar */
  inCalendar?: string;
  /** Match events with this id */
  id?: string;
  /** Match events with this exact UID */
  uid?: string;
  /** Match events with title containing this string */
  title?: string;
  /** Match events with description containing this string */
  description?: string;
  /** Match events with location name containing this string */
  location?: string;
  /** Match events starting after this time */
  after?: string;
  /** Match events starting before this time */
  before?: string;
  /** Match events overlapping this time range */
  inTimeRange?: { start: string; end: string };
  /** Match events in these calendars */
  calendarIds?: Record<string, boolean>;
  /** Match events with this participant */
  hasParticipant?: string;
  /** Match events organized by this email address */
  organizerCalendarAddress?: string;
  /** Match events with this status */
  status?: 'confirmed' | 'tentative' | 'cancelled';
  /** Match events with this free/busy status */
  freeBusyStatus?: FreeBusyStatus;
  /** Match events with this privacy level */
  privacy?: 'public' | 'private' | 'secret';
  /** Match all-day events */
  isAllDay?: boolean;
  /** Match recurring events */
  isRecurring?: boolean;
  /** Match events with alerts */
  hasAlarm?: boolean;
  /** Match events with attachments */
  hasAttachment?: boolean;
  /** Match draft events */
  isDraft?: boolean;
  /** Match events with this server-calculated UTC start */
  utcStart?: string;
  /** Match events with this server-calculated UTC end */
  utcEnd?: string;
  /** Match events with this base event id */
  baseEventId?: string;
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
  accountId?: string | null;
  ids: string[] | null;
  properties?: string[] | null;
}

/**
 * Response from Calendar/get
 */
export interface CalendarGetResponse {
  accountId: string;
  state: string;
  list: Calendar[];
  notFound?: string[];
}

/**
 * Arguments for Calendar/changes
 */
export interface CalendarChangesRequest {
  accountId?: string | null;
  sinceState: string;
  maxChanges?: number | null;
}

/**
 * Response from Calendar/changes
 */
export interface CalendarChangesResponse {
  accountId: string;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: string[];
  updated: string[];
  destroyed: string[];
}

/**
 * Calendar object for create/update in Calendar/set
 */
export interface CalendarPatch {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isSubscribed?: boolean;
  isVisible?: boolean;
  includeInAvailability?: 'all' | 'attending' | 'none';
  color?: string | null;
  timeZone?: string | null;
  shareWith?: Record<string, CalendarRights> | null;
  defaultAlertsWithTime?: Record<string, Alert> | null;
  defaultAlertsWithoutTime?: Record<string, Alert> | null;
}

/**
 * Arguments for Calendar/set
 * Per draft Section 4.3
 */
export interface CalendarSetRequest {
  accountId?: string | null;
  ifInState?: string | null;
  create?: Record<string, CalendarPatch> | null;
  update?: Record<string, CalendarPatch> | null;
  destroy?: string[] | null;
  /** If true, events in a destroyed calendar are also destroyed */
  onDestroyRemoveEvents?: boolean | null;
  /** If set, the calendar created/set as the default for the account */
  onSuccessSetIsDefault?: string[] | null;
}

/**
 * Response from Calendar/set
 */
export interface CalendarSetResponse {
  accountId: string;
  oldState?: string | null;
  newState: string;
  created?: Record<string, Calendar | { type: string; description?: string }>;
  updated?: Record<string, Calendar | null | { type: string; description?: string }>;
  destroyed?: Record<string, null | { type: string; description?: string }>;
  notCreated?: Record<string, { type: string; description?: string }>;
  notUpdated?: Record<string, { type: string; description?: string }>;
  notDestroyed?: Record<string, { type: string; description?: string }>;
}

/**
 * Arguments for Calendar/query
 */
export interface CalendarQueryRequest {
  accountId?: string | null;
  filter?: CalendarFilter | null;
  sort?: Array<{ property: string; isAscending?: boolean }> | null;
  position?: number | null;
  limit?: number | null;
  calculateTotal?: boolean;
}

/**
 * Response from Calendar/query
 */
export interface CalendarQueryResponse {
  accountId: string;
  queryState: string;
  canCalculateChanges: boolean;
  position: number;
  total?: number;
  ids: string[];
  sort?: Array<{ property: string; isAscending?: boolean }>;
}

/**
 * Arguments for CalendarEvent/get
 */
export interface CalendarEventGetRequest {
  accountId?: string | null;
  calendarIds?: string[] | null;
  ids?: string[] | null;
  properties?: string[] | null;
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
  calendarIds?: Record<string, boolean>;
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
  excludedRecurrenceRules?: RecurrenceRule[] | null;
  relatedTo?: { type?: string; id: string } | null;
  mayInviteSelf?: boolean;
  mayInviteOthers?: boolean;
  hideAttendees?: boolean;
  organizer?: Participant;
  participants?: Record<string, Participant>;
  locations?: Record<string, Location>;
  virtualLocations?: Record<string, Link>;
  links?: Record<string, Link>;
  attachments?: Record<string, Link>;
  alerts?: Record<string, Alert>;
  useDefaultAlerts?: boolean;
  percentComplete?: number;
  due?: string;
  estimatedDuration?: number;
  locale?: string;
}

/**
 * Arguments for CalendarEvent/set
 * Per draft Section 5.9.2
 */
export interface CalendarEventSetRequest {
  accountId?: string | null;
  ifInState?: string | null;
  create?: Record<string, CalendarEventPatch>;
  update?: Record<string, CalendarEventPatch>;
  destroy?: string[];
  /** If present, send scheduling messages for the operation */
  sendSchedulingMessage?: 'whenNeeded' | 'always' | 'never';
}

/**
 * Response from CalendarEvent/set
 */
export interface CalendarEventSetResponse {
  accountId: string;
  oldState?: string | null;
  newState: string;
  created?: Record<string, CalendarEvent | { type: string; description?: string }>;
  updated?: Record<string, CalendarEvent | null | { type: string; description?: string }>;
  destroyed?: Record<string, null | { type: string; description?: string }>;
  notCreated?: Record<string, { type: string; description?: string }>;
  notUpdated?: Record<string, { type: string; description?: string }>;
  notDestroyed?: Record<string, { type: string; description?: string }>;
}

/**
 * Arguments for CalendarEvent/query
 */
export interface CalendarEventQueryRequest {
  accountId?: string | null;
  calendarIds?: string[] | null;
  filter?: CalendarEventFilter | null;
  sort?: Array<{ property: string; isAscending?: boolean }> | null;
  position?: number | null;
  limit?: number | null;
  calculateTotal?: boolean;
  expandRecurrences?: boolean;
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

// ============ CalendarEvent/copy (draft Section 5.10) ============

/**
 * Arguments for CalendarEvent/copy
 */
export interface CalendarEventCopyRequest {
  accountId?: string | null;
  /** The ids of events to copy */
  ids: string[];
  /** IfInState for optimistic concurrency */
  ifInState?: string | null;
  /** Map of original event id to the calendarIds to copy into */
  calendarIds?: Record<string, Record<string, boolean>>;
  /** Properties to update on the copied events */
  propertiesToUpdate?: Record<string, CalendarEventPatch>;
  /** Whether to send scheduling messages */
  sendSchedulingMessage?: 'whenNeeded' | 'always' | 'never';
}

/**
 * Response from CalendarEvent/copy
 */
export interface CalendarEventCopyResponse {
  accountId: string;
  oldState?: string | null;
  newState: string;
  copied?: Record<string, CalendarEvent | { type: string; description?: string }>;
  notCopied?: Record<string, { type: string; description?: string }>;
}

// ============ CalendarEvent/queryChanges (draft Section 5.12) ============

/**
 * Arguments for CalendarEvent/queryChanges
 */
export interface CalendarEventQueryChangesRequest {
  accountId?: string | null;
  filter?: CalendarEventFilter | null;
  sort?: Array<{ property: string; isAscending?: boolean }> | null;
  sinceQueryState: string;
  maxChanges?: number | null;
  upToId?: string | null;
  calculateTotal?: boolean;
}

/**
 * Response from CalendarEvent/queryChanges
 */
export interface CalendarEventQueryChangesResponse {
  accountId: string;
  oldQueryState: string;
  newQueryState: string;
  total?: number;
  added: Array<{ id: string; index: number }>;
  removed: string[];
}

// ============ CalendarEvent/parse (draft Section 5.13) ============

/**
 * Arguments for CalendarEvent/parse
 */
export interface CalendarEventParseRequest {
  accountId?: string | null;
  /** The blob ids of iCalendar data to parse */
  blobIds: string[];
}

/**
 * Response from CalendarEvent/parse
 */
export interface CalendarEventParseResponse {
  accountId: string;
  parsed?: Record<string, CalendarEvent | { type: string; description?: string }>;
  notParsed?: Record<string, { type: string; description?: string }>;
}

// ============ CalendarEventNotification/query (draft Section 7.4) ============

/**
 * Filter condition for CalendarEventNotification/query
 */
export interface CalendarEventNotificationFilterCondition {
  /** Match by notification type */
  type?: NotificationType;
  /** Match by event id */
  eventId?: string;
  /** Match by calendar id */
  calendarId?: string;
  /** Match read/unread */
  isRead?: boolean;
  /** Match notifications created after this time */
  after?: string;
  /** Match notifications created before this time */
  before?: string;
}

/**
 * Filter operator for CalendarEventNotification/query
 */
export interface CalendarEventNotificationFilterOperator {
  allOf?: CalendarEventNotificationFilter[];
  anyOf?: CalendarEventNotificationFilter[];
  noneOf?: CalendarEventNotificationFilter[];
}

export type CalendarEventNotificationFilter = CalendarEventNotificationFilterCondition | CalendarEventNotificationFilterOperator;

/**
 * Arguments for CalendarEventNotification/query
 */
export interface CalendarEventNotificationQueryRequest {
  accountId?: string | null;
  filter?: CalendarEventNotificationFilter | null;
  sort?: Array<{ property: string; isAscending?: boolean }> | null;
  position?: number | null;
  limit?: number | null;
  calculateTotal?: boolean;
}

/**
 * Response from CalendarEventNotification/query
 */
export interface CalendarEventNotificationQueryResponse {
  accountId: string;
  queryState: string;
  canCalculateChanges: boolean;
  position: number;
  total?: number;
  ids: string[];
}

/**
 * Arguments for CalendarEventNotification/queryChanges
 */
export interface CalendarEventNotificationQueryChangesRequest {
  accountId?: string | null;
  filter?: CalendarEventNotificationFilter | null;
  sort?: Array<{ property: string; isAscending?: boolean }> | null;
  sinceQueryState: string;
  maxChanges?: number | null;
  upToId?: string | null;
  calculateTotal?: boolean;
}

/**
 * Response from CalendarEventNotification/queryChanges
 */
export interface CalendarEventNotificationQueryChangesResponse {
  accountId: string;
  oldQueryState: string;
  newQueryState: string;
  total?: number;
  added: Array<{ id: string; index: number }>;
  removed: string[];
}

/**
 * Arguments for CalendarEventNotification/get
 */
export interface CalendarEventNotificationGetRequest {
  accountId?: string | null;
  ids: string[] | null;
  properties?: string[] | null;
}

/**
 * Response from CalendarEventNotification/get
 */
export interface CalendarEventNotificationGetResponse {
  accountId: string;
  state: string;
  list: CalendarNotification[];
  notFound?: string[];
}

/**
 * Arguments for CalendarEventNotification/changes
 */
export interface CalendarEventNotificationChangesRequest {
  accountId?: string | null;
  sinceState: string;
  maxChanges?: number | null;
}

/**
 * Response from CalendarEventNotification/changes
 */
export interface CalendarEventNotificationChangesResponse {
  accountId: string;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: string[];
  updated: string[];
  destroyed: string[];
}

/**
 * Patch object for CalendarEventNotification/set
 */
export interface CalendarEventNotificationPatch {
  isRead?: boolean;
  properties?: Record<string, unknown>;
}

/**
 * Arguments for CalendarEventNotification/set
 */
export interface CalendarEventNotificationSetRequest {
  accountId?: string | null;
  ifInState?: string | null;
  update?: Record<string, CalendarEventNotificationPatch> | null;
  destroy?: string[] | null;
}

/**
 * Response from CalendarEventNotification/set
 */
export interface CalendarEventNotificationSetResponse {
  accountId: string;
  oldState?: string | null;
  newState: string;
  updated?: Record<string, CalendarNotification | null | { type: string; description?: string }>;
  destroyed?: Record<string, null | { type: string; description?: string }>;
  notUpdated?: Record<string, { type: string; description?: string }>;
  notDestroyed?: Record<string, { type: string; description?: string }>;
}

// ============ Principal/getAvailability (draft Section 2.2) ============

/**
 * Arguments for Principal/getAvailability
 */
export interface PrincipalGetAvailabilityRequest {
  accountId?: string | null;
  /** The principal ids to check availability for */
  ids: string[];
  /** Start of the time range */
  start: string;
  /** End of the time range */
  end: string;
}

/**
 * A busy time slot for a principal
 */
export interface BusyTimeSlot {
  /** Start of the busy period */
  start: string;
  /** End of the busy period */
  end: string;
  /** Whether this is free, busy, tentative, or unavailable */
  status?: FreeBusyStatus;
}

/**
 * Availability information for a principal
 */
export interface PrincipalAvailability {
  /** The principal id */
  id: string;
  /** Busy time slots within the requested range */
  busy: BusyTimeSlot[];
  /** Whether the principal is available for the entire range */
  isAvailable?: boolean;
}

/**
 * Response from Principal/getAvailability
 */
export interface PrincipalGetAvailabilityResponse {
  accountId: string;
  /** Map of principal id to availability information */
  list: Record<string, PrincipalAvailability>;
  notFound?: string[];
}

// ============ Error Type ============

export interface Error {
  type: string;
  description?: string | null;
  properties?: string[] | null;
}
