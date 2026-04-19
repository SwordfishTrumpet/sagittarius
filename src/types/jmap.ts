/**
 * JMAP Type Definitions
 * 
 * Core types for RFC 8620 (JMAP Core) and RFC 8621 (JMAP Mail) compliance.
 * These types replace the excessive `any` usage throughout the codebase.
 */

// ============ JMAP Core Types ============

export interface JMAPAccount {
  id?: string;
  name: string;
  isPersonal: boolean;
  isReadOnly?: boolean;
  accountCapabilities: Record<string, unknown>;
}

/**
 * JMAP Session object per RFC 8620 §2
 * 
 * Note: `username` is a server extension (not part of RFC 8620) but commonly provided.
 * Note: `eventSourceUrl` is REQUIRED per RFC 8620, but we mark it optional for
 *       graceful handling of non-compliant servers.
 */
export interface JMAPSession {
  /** Server extension: the authenticated username */
  username?: string;
  /** RFC 8620 §2: URL for JMAP API requests */
  apiUrl: string;
  /** RFC 8620 §2: URL template for blob downloads */
  downloadUrl: string;
  /** RFC 8620 §2: URL template for blob uploads */
  uploadUrl: string;
  /** RFC 8620 §2: URL template for EventSource push notifications */
  eventSourceUrl?: string;
  /** RFC 8887: WebSocket URL (may also be in capabilities["urn:ietf:params:jmap:websocket"].url) */
  webSocketUrl?: string;
  /** RFC 8620 §2: Server capabilities */
  capabilities: Record<string, unknown>;
  /** RFC 8620 §2: Map of capability URN to primary accountId */
  primaryAccounts: Record<string, string>;
  /** RFC 8620 §2: Map of accountId to account details */
  accounts: Record<string, JMAPAccount>;
  /** RFC 8620 §2: Opaque session state string */
  state?: string;
}

export interface JMAPMethodCallObject {
  method: string;
  args: Record<string, unknown>;
  id: string;
}

/**
 * JMAP method calls can be sent as either:
 * - Tuple format: [methodName, arguments, methodId]
 * - Object format: { method, args, id }
 */
export type JMAPMethodCall = JMAPMethodCallObject | [string, Record<string, unknown>, string];

export interface JMAPMethodResponse {
  method: string;
  args: Record<string, unknown>;
  id: string;
}

export interface JMAPStateChange {
  /** Map of accountId -> { dataType -> newState } per RFC 8887 §4.3 */
  changed?: Record<string, Record<string, string>>;
  /** Map of accountId -> { dataType -> newState } for removed items */
  removed?: Record<string, Record<string, string>>;
  pushSubscriptionId?: string;
}

// ============ JMAP Mail Types ============

export interface Mailbox {
  id: string;
  name: string;
  parentId: string | null;
  role: 'inbox' | 'sent' | 'trash' | 'drafts' | 'archive' | 'spam' | null;
  sortOrder: number;
  totalEmails: number;
  unreadEmails: number;
  totalThreads: number;
  unreadThreads: number;
  myRights: MailboxRights;
  isSubscribed: boolean;
  childIds?: string[];
  /**
   * For UI state - not part of JMAP spec
   */
  isExpanded?: boolean;
}

export interface MailboxRights {
  mayReadItems: boolean;
  mayAddItems: boolean;
  mayRemoveItems: boolean;
  maySetSeen: boolean;
  maySetKeywords: boolean;
  mayCreateChild: boolean;
  mayRename: boolean;
  mayDelete: boolean;
  maySubmit: boolean;
}

export interface EmailAddress {
  name?: string | null;
  email: string;
}

export interface EmailHeader {
  name: string;
  value: string;
}

export interface EmailBodyPart {
  partId?: string;
  blobId?: string;
  size?: number;
  name?: string;
  type: string;
  charset?: string;
  disposition?: string;
  cid?: string | null;
  language?: string[] | null;
  location?: string | null;
  subParts?: EmailBodyPart[];
  bodyStructure?: EmailBodyPart;
  headers?: EmailHeader[];
}

export interface EmailBodyValue {
  value: string;
  isEncodingProblem?: boolean;
  isTruncated?: boolean;
}

export interface Email {
  id: string;
  blobId: string;
  threadId: string;
  mailboxIds: Record<string, boolean>;
  keywords: Record<string, boolean>;
  size: number;
  receivedAt: string;
  sentAt?: string | null;
  hasAttachment: boolean;
  preview: string;
  subject: string;
  from: EmailAddress[] | null;
  to: EmailAddress[] | null;
  cc: EmailAddress[] | null;
  bcc: EmailAddress[] | null;
  replyTo: EmailAddress[] | null;
  sender?: EmailAddress[] | null;
  messageId?: string[] | null;
  inReplyTo?: string[] | null;
  references?: string[] | null;
  htmlBody?: EmailBodyPart[] | null;
  textBody?: EmailBodyPart[] | null;
  bodyValues?: Record<string, EmailBodyValue> | null;
  bodyStructure?: EmailBodyPart | null;
  attachments?: EmailBodyPart[];
  headers?: EmailHeader[];
  /**
   * UI-specific properties (not part of JMAP spec)
   */
  isUnread?: boolean;
  isFlagged?: boolean;
  isSent?: boolean;
  snippet?: string;
  searchSnippet?: string;
  /** Thread count when email represents a thread */
  threadCount?: number;
}

export interface Thread {
  id: string;
  emailIds: string[];
}

export interface Identity {
  id: string;
  name: string;
  email: string;
  replyTo?: EmailAddress[] | null;
  bcc?: EmailAddress[] | null;
  textSignature?: string;
  htmlSignature?: string;
  mayDelete: boolean;
}

export interface EmailSubmission {
  id: string;
  emailId: string;
  threadId?: string;
  identityId: string;
  envelope?: {
    mailFrom: { email: string; parameters?: string[] | null };
    rcptTo: { email: string; parameters?: string[] | null }[];
  } | null;
  sendAt?: string | null;
  undoStatus?: 'pending' | 'final' | 'canceled';
  deliveryStatus?: Record<string, DeliveryStatus> | null;
}

export interface DeliveryStatus {
  smtpReply?: string;
  delivered?: 'queued' | 'yes' | 'no' | 'unknown';
  displayed?: 'yes' | 'no' | 'unknown';
}

export interface Quota {
  id: string;
  resourceType?: string;
  used: number;
  /** RFC 9425 uses hardLimit for storage quotas */
  hardLimit?: number;
  /** Alias for total storage (hardLimit) */
  total?: number;
  scope?: 'account' | 'domain' | 'global' | string;
  name?: string;
  warnLimit?: number;
  softLimit?: number;
  description?: string;
  types?: string[];
}

/**
 * Quota Filter Condition per RFC 9425
 * Used for Quota/query filter parameter
 */
export interface QuotaFilterCondition {
  /** Quota IDs to match */
  ids?: string[];
  /** Resource type (e.g., 'octets', 'messages') */
  resourceType?: string;
  /** Scope of the quota (e.g., 'account', 'domain') */
  scope?: string;
  /** Name contains this string */
  name?: string;
  /** Types this quota applies to */
  types?: string[];
}

/**
 * Quota Filter Operator for combining conditions
 */
export interface QuotaFilterOperator {
  /** AND - all conditions must match */
  allOf?: (QuotaFilterCondition | QuotaFilterOperator)[];
  /** OR - any condition can match */
  anyOf?: (QuotaFilterCondition | QuotaFilterOperator)[];
  /** NOT - condition must not match */
  not?: QuotaFilterCondition | QuotaFilterOperator;
}

/** Combined Quota Filter type */
export type QuotaFilter = QuotaFilterCondition | QuotaFilterOperator;

// ============ Search Types ============

export interface SearchFilter {
  inMailbox?: string | null;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  text?: string;
  after?: string | null;
  before?: string | null;
  minSize?: number | null;
  maxSize?: number | null;
  flagged?: boolean | null;
  unread?: boolean | null;
}

// ============ JMAP Email/query Filter Types (RFC 8621 §4.4) ============

/**
 * JMAP Email Filter Condition per RFC 8621 §4.4.1
 * Used for Email/query filter parameter
 */
export interface EmailFilterCondition {
  /** Email IDs to match */
  ids?: string[];
  /** Must be in this mailbox */
  inMailbox?: string;
  /** Must NOT be in this mailbox */
  notInMailbox?: string;
  /** Must be in a mailbox with this role */
  inMailboxOtherThan?: string[];
  /** From field contains */
  from?: string;
  /** To field contains */
  to?: string;
  /** Cc field contains */
  cc?: string;
  /** Bcc field contains (server may not expose) */
  bcc?: string;
  /** Subject field contains */
  subject?: string;
  /** Body text contains */
  body?: string;
  /** Any text field contains */
  text?: string;
  /** Header field contains */
  header?: string[];
  /** Must have this attachment */
  hasAttachment?: boolean;
  /** File name pattern for attachments */
  attachmentName?: string;
  /** Must have this keyword */
  hasKeyword?: string;
  /** Must NOT have this keyword */
  notHasKeyword?: string;
  /** Minimum size in bytes */
  minSize?: number;
  /** Maximum size in bytes */
  maxSize?: number;
  /** Received on or after this date (UTCDate) */
  after?: string;
  /** Received on or before this date (UTCDate) */
  before?: string;
}

/**
 * JMAP Filter Operator per RFC 8620 §5.5
 * Allows combining conditions with AND, OR, NOT logic
 */
export interface EmailFilterOperator {
  /** AND - all conditions must match */
  allOf?: (EmailFilterCondition | EmailFilterOperator)[];
  /** OR - any condition can match */
  anyOf?: (EmailFilterCondition | EmailFilterOperator)[];
  /** NOT - condition must not match */
  not?: EmailFilterCondition | EmailFilterOperator;
  /**
   * Legacy operator field (some servers use this format)
   * @deprecated Use allOf/anyOf/not instead per RFC 8620
   */
  operator?: 'AND' | 'OR' | 'NOT';
  /**
   * Legacy conditions field
   * @deprecated Use allOf/anyOf/not instead
   */
  conditions?: (EmailFilterCondition | EmailFilterOperator)[];
}

/** Combined Email Filter type - either a condition or an operator */
export type EmailFilter = EmailFilterCondition | EmailFilterOperator;

// ============ Attachment Types ============

export interface Attachment {
  blobId: string;
  name: string;
  type: string;
  size: number;
  partId?: string;
}

// ============ Draft Types ============

export interface ComposerDraft {
  key: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: Attachment[];
  selectedIdentityId: string | null;
  showCcBcc: boolean;
  sendAt: string | null;
  isQuoteCollapsed: boolean;
  timestamp: number;
}

// ============ JMAP Response Types ============

/**
 * Generic JMAP /get response structure
 */
export interface JMAPGetResponse<T> {
  accountId: string;
  state: string;
  list: T[];
  notFound?: string[];
}

/**
 * Generic JMAP /set response structure
 */
export interface JMAPSetResponse<T> {
  accountId: string;
  oldState?: string;
  newState: string;
  created?: Record<string, T>;
  updated?: Record<string, T | null>;
  destroyed?: string[];
  notCreated?: Record<string, JMAPSetError>;
  notUpdated?: Record<string, JMAPSetError>;
  notDestroyed?: Record<string, JMAPSetError>;
}

/**
 * JMAP /query response structure
 */
export interface JMAPQueryResponse {
  accountId: string;
  queryState: string;
  canCalculateChanges: boolean;
  position: number;
  ids: string[];
  total?: number;
  limit?: number;
}

/**
 * JMAP /changes response structure
 */
export interface JMAPChangesResponse {
  accountId: string;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: string[];
  updated: string[];
  destroyed: string[];
}

/**
 * JMAP error response
 */
export interface JMAPError {
  type: string;
  description?: string;
}

/**
 * JMAP /set error for individual items
 */
export interface JMAPSetError {
  type: string;
  description?: string;
  properties?: string[];
}

/**
 * MDN/send response
 */
export interface MDNSendResponse {
  accountId: string;
  sent?: Record<string, { emailId: string }>;
  notSent?: Record<string, JMAPSetError>;
}

/**
 * VacationResponse object
 */
export interface VacationResponse {
  id: string;
  isEnabled: boolean;
  fromDate?: string | null;
  toDate?: string | null;
  subject?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
}

/**
 * Reply/Forward context for composer
 */
export interface ReplyContext {
  id: string;
  subject?: string;
  from?: EmailAddress[] | null;
  to?: EmailAddress[] | null;
  cc?: EmailAddress[] | null;
  textBody?: string;
  htmlBody?: string;
  blobId?: string;
  threadId?: string;
  _replyAll?: boolean;
  _forward?: boolean;
}

/**
 * UseMutation result wrapper (simplified for typing)
 */
export interface MutationFn<TData, TVariables> {
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending: boolean;
}

/**
 * SearchSnippet object
 */
export interface SearchSnippet {
  emailId: string;
  subject?: string;
  preview?: string;
}

// ============ Type Guards & Helpers ============

/**
 * Type guard to check if a method response is an error
 */
export function isJMAPError(response: unknown): response is JMAPError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'type' in response &&
    typeof (response as JMAPError).type === 'string'
  );
}

/**
 * Safely extract a /get response from method responses
 */
export function extractGetResponse<T>(
  methodResponses: [string, unknown, string][],
  index = 0
): JMAPGetResponse<T> | null {
  const response = methodResponses[index];
  if (!response) return null;
  
  const [method, result] = response;
  if (method === 'error' || !result) return null;
  
  return result as JMAPGetResponse<T>;
}

/**
 * Safely extract a /query response from method responses
 */
export function extractQueryResponse(
  methodResponses: [string, unknown, string][],
  index = 0
): JMAPQueryResponse | null {
  const response = methodResponses[index];
  if (!response) return null;
  
  const [method, result] = response;
  if (method === 'error' || !result) return null;
  
  return result as JMAPQueryResponse;
}

/**
 * Safely extract a /set response from method responses
 */
export function extractSetResponse<T>(
  methodResponses: [string, unknown, string][],
  index = 0
): JMAPSetResponse<T> | null {
  const response = methodResponses[index];
  if (!response) return null;
  
  const [method, result] = response;
  if (method === 'error' || !result) return null;
  
  return result as JMAPSetResponse<T>;
}

/**
 * Safely extract a /changes response from method responses
 */
export function extractChangesResponse(
  methodResponses: [string, unknown, string][],
  index = 0
): JMAPChangesResponse | null {
  const response = methodResponses[index]
  if (!response) return null
  
  const [method, result] = response
  if (method === 'error' || !result) return null
  
  return result as JMAPChangesResponse
}

// ============ JMAP Query Filter Types ============

/**
 * Mailbox Filter Condition per RFC 8621 §4.4
 * Used for Mailbox/query filter parameter
 */
export interface MailboxFilterCondition {
  /** Parent mailbox ID */
  parentId?: string | null;
  /** Mailbox name contains */
  name?: string;
  /** Has this role (e.g., 'inbox', 'sent') */
  role?: string;
  /** Is subscribed */
  isSubscribed?: boolean;
}

/**
 * Mailbox Filter Operator for combining conditions
 */
export interface MailboxFilterOperator {
  /** AND - all conditions must match */
  allOf?: (MailboxFilterCondition | MailboxFilterOperator)[];
  /** OR - any condition can match */
  anyOf?: (MailboxFilterCondition | MailboxFilterOperator)[];
  /** NOT - condition must not match */
  not?: MailboxFilterCondition | MailboxFilterOperator;
}

/** Combined Mailbox Filter type */
export type MailboxFilter = MailboxFilterCondition | MailboxFilterOperator;

/**
 * Thread Filter Condition per RFC 8621 §4.4
 * Used for Thread/query filter parameter
 */
export interface ThreadFilterCondition {
  /** Thread IDs to match */
  ids?: string[];
  /** Must include an email in this mailbox */
  inMailbox?: string;
  /** Must include an email from this sender */
  from?: string;
  /** Must include an email to this recipient */
  to?: string;
  /** Must include an email with this subject */
  subject?: string;
  /** Thread has any text matching */
  text?: string;
  /** Thread has attachments */
  hasAttachment?: boolean;
  /** Thread has this keyword */
  hasKeyword?: string;
  /** Thread does not have this keyword */
  notHasKeyword?: string;
  /** Thread has email received after this date */
  after?: string;
  /** Thread has email received before this date */
  before?: string;
  /** Minimum total size of emails in thread */
  minSize?: number;
  /** Maximum total size of emails in thread */
  maxSize?: number;
}

/**
 * Thread Filter Operator for combining conditions
 */
export interface ThreadFilterOperator {
  /** AND - all conditions must match */
  allOf?: (ThreadFilterCondition | ThreadFilterOperator)[];
  /** OR - any condition can match */
  anyOf?: (ThreadFilterCondition | ThreadFilterOperator)[];
  /** NOT - condition must not match */
  not?: ThreadFilterCondition | ThreadFilterOperator;
}

/** Combined Thread Filter type */
export type ThreadFilter = ThreadFilterCondition | ThreadFilterOperator;

/**
 * Identity Filter Condition for Identity/query
 */
export interface IdentityFilterCondition {
  /** Identity IDs to match */
  ids?: string[];
  /** Email address contains */
  email?: string;
  /** Name contains */
  name?: string;
  /** May delete this identity */
  mayDelete?: boolean;
}

/**
 * Identity Filter Operator for combining conditions
 */
export interface IdentityFilterOperator {
  /** AND - all conditions must match */
  allOf?: (IdentityFilterCondition | IdentityFilterOperator)[];
  /** OR - any condition can match */
  anyOf?: (IdentityFilterCondition | IdentityFilterOperator)[];
  /** NOT - condition must not match */
  not?: IdentityFilterCondition | IdentityFilterOperator;
}

/** Combined Identity Filter type */
export type IdentityFilter = IdentityFilterCondition | IdentityFilterOperator;

// ============ JMAP Query Sort Types ============

/**
 * Sort comparator for JMAP queries per RFC 8620 §5.5
 */
export interface JMAPSortComparator {
  /** Property to sort by */
  property: string;
  /** Sort in ascending order (default: false) */
  isAscending?: boolean;
  /** Collation for string comparison (optional) */
  collation?: string;
}

// ============ JMAP Copy Types ============

/**
 * Email/copy request arguments per RFC 8620 §5.4
 */
export interface EmailCopyRequest {
  accountId: string;
  fromAccountId: string;
  create: Record<string, { id: string; mailboxIds: Record<string, boolean>; keywords?: Record<string, boolean> }>;
  onSuccessDestroyOriginal?: boolean;
  destroyFromIfSuccess?: boolean;
}

/**
 * Email/copy response per RFC 8620 §5.4
 */
export interface EmailCopyResponse {
  accountId: string;
  fromAccountId: string;
  created?: Record<string, { id: string; blobId: string; threadId: string; size: number }>;
  notCreated?: Record<string, JMAPSetError>;
}

// ============ Email Template Types (Local Storage) ============

/**
 * Email template for reusable email formats
 * Stored locally since there's no JMAP RFC for templates yet
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  to?: string;
  cc?: string;
  bcc?: string;
  createdAt: number;
  updatedAt: number;
  accountId: string;
}

/**
 * Template creation payload
 */
export interface CreateTemplatePayload {
  name: string;
  subject: string;
  body: string;
  to?: string;
  cc?: string;
  bcc?: string;
}

/**
 * Template update payload (all fields optional)
 */
export interface UpdateTemplatePayload {
  name?: string;
  subject?: string;
  body?: string;
  to?: string;
  cc?: string;
  bcc?: string;
}

// ============ Type Casting Helpers ============

/**
 * Helper interface for Mailbox/get response
 * Used for safely casting JMAP response data
 */
export interface MailboxGetResult {
  list: Mailbox[];
}

/**
 * Type guard/cast helper for Mailbox/get response data
 * Use this instead of inline `as MailboxGetResult` assertions for consistency
 * @param data - Unknown data from JMAP response
 * @returns Typed MailboxGetResult (unsafe cast — validate data first)
 */
export function asMailboxGet(data: unknown): MailboxGetResult {
  return data as MailboxGetResult;
}
