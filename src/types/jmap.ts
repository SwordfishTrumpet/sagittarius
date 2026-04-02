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

export interface JMAPSession {
  apiUrl: string;
  downloadUrl: string;
  uploadUrl: string;
  eventSourceUrl?: string;
  capabilities: Record<string, unknown>;
  primaryAccounts: Record<string, string>;
  accounts: Record<string, JMAPAccount>;
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
  used: number;
  total: number;
  scope: 'account' | 'domain' | 'global';
  name?: string;
  warnLimit?: number;
  softLimit?: number;
  description?: string;
}

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
  const response = methodResponses[index];
  if (!response) return null;
  
  const [method, result] = response;
  if (method === 'error' || !result) return null;
  
  return result as JMAPChangesResponse;
}
