import { jmapClient } from '../api/jmap';

// ============ Generic Capability Helper ============

/**
 * Generic helper to get account capability configuration with fallback defaults
 * Handles the common try/catch pattern used across capability getters
 * @param urn - The capability URN to retrieve
 * @param defaults - Default values to use if capability not available
 * @returns Merged capability config with defaults
 */
function getAccountCapabilityWithFallback<T>(urn: string, defaults: T): T {
  let capabilities: Partial<T> | null = null;
  try {
    capabilities = jmapClient.getAccountCapability?.(urn) as Partial<T> | null;
  } catch {
    // Client methods may not be available during tests
    capabilities = null;
  }

  return {
    ...defaults,
    ...capabilities,
  } as T;
}

/**
 * Generic helper to get global capability configuration with fallback defaults
 * Uses getCapabilityConfig instead of getAccountCapability for core capabilities
 * @param urn - The capability URN to retrieve
 * @param defaults - Default values to use if capability not available
 * @returns Merged capability config with defaults
 */
function getCapabilityConfigWithFallback<T>(urn: string, defaults: T): T {
  let capabilities: Partial<T> | null = null;
  try {
    capabilities = jmapClient.getCapabilityConfig?.(urn) as Partial<T> | null;
  } catch {
    // Client methods may not be available during tests
    capabilities = null;
  }

  return {
    ...defaults,
    ...capabilities,
  } as T;
}

// ============ JMAP Core Capability Limits (RFC 8620 §2) ============
export interface CoreCapabilityLimits {
  /** Maximum size of a single upload in bytes */
  maxSizeUpload: number;
  /** Maximum number of concurrent uploads */
  maxConcurrentUpload: number;
  /** Maximum number of concurrent requests */
  maxConcurrentRequests: number;
  /** Maximum number of method calls in a single request */
  maxCallsInRequest: number;
  /** Maximum number of objects in a /get method */
  maxObjectsInGet: number;
  /** Maximum number of objects in a /set method */
  maxObjectsInSet: number;
}

/** Default limits per RFC 8620 §2 */
const DEFAULT_CORE_LIMITS: CoreCapabilityLimits = {
  maxSizeUpload: 50_000_000, // 50MB
  maxConcurrentUpload: 4,
  maxConcurrentRequests: 4,
  maxCallsInRequest: 16,
  maxObjectsInGet: 500,
  maxObjectsInSet: 500,
};

/**
 * Get JMAP Core capability limits from the session
 * Falls back to RFC 8620 defaults if not specified
 */
export function getCoreCapabilityLimits(): CoreCapabilityLimits {
  return getCapabilityConfigWithFallback(
    'urn:ietf:params:jmap:core',
    DEFAULT_CORE_LIMITS
  );
}

/**
 * JMAP Mail Capability Limits (RFC 8621)
 */
export interface MailCapabilityLimits {
  /** Maximum size of all attachments per email in bytes */
  maxSizeAttachmentsPerEmail: number;
  /** Can the user create top-level mailboxes */
  mayCreateTopLevelMailbox: boolean;
  /** Maximum depth of mailbox hierarchy */
  maxMailboxDepth: number | null;
  /** Maximum number of mailboxes an email can belong to */
  maxMailboxesPerEmail: number | null;
  /** Maximum length of a mailbox name */
  maxSizeMailboxName: number;
  /** Supported sort options for Email/query */
  emailQuerySortOptions: string[];
}

/** Default mail limits per RFC 8621 */
const DEFAULT_MAIL_LIMITS: MailCapabilityLimits = {
  maxSizeAttachmentsPerEmail: 50_000_000, // 50MB
  mayCreateTopLevelMailbox: true,
  maxMailboxDepth: null, // Unlimited
  maxMailboxesPerEmail: null, // Unlimited
  maxSizeMailboxName: 255,
  emailQuerySortOptions: ['receivedAt', 'sentAt', 'from', 'to', 'subject', 'size', 'keywords'],
};

/**
 * Get JMAP Mail capability limits for the primary account
 */
export function getMailCapabilityLimits(): MailCapabilityLimits {
  return getAccountCapabilityWithFallback(
    'urn:ietf:params:jmap:mail',
    DEFAULT_MAIL_LIMITS
  );
}

/**
 * JMAP Sieve Capability Limits (RFC 9266)
 */
export interface SieveCapabilityLimits {
  /** Maximum number of Sieve scripts */
  maxNumberScripts: number;
  /** Maximum size of a Sieve script in bytes */
  maxSizeScript: number;
}

/** Default sieve limits */
const DEFAULT_SIEVE_LIMITS: SieveCapabilityLimits = {
  maxNumberScripts: 100,
  maxSizeScript: 1_048_576, // 1MB
};

/**
 * Get JMAP Sieve capability limits for the primary account
 */
export function getSieveCapabilityLimits(): SieveCapabilityLimits {
  return getAccountCapabilityWithFallback(
    'urn:ietf:params:jmap:sieve',
    DEFAULT_SIEVE_LIMITS
  );
}

/**
 * JMAP Calendar Capability Limits (RFC 8984)
 */
export interface CalendarCapabilityLimits {
  /** Maximum number of participants per event */
  maxParticipantsPerEvent: number | null;
  /** Maximum number of calendars an event can belong to */
  maxCalendarsPerEvent: number | null;
  /** Can the user create calendars */
  mayCreateCalendar: boolean;
}

/** Default calendar limits */
const DEFAULT_CALENDAR_LIMITS: CalendarCapabilityLimits = {
  maxParticipantsPerEvent: null, // Unlimited
  maxCalendarsPerEvent: null, // Unlimited
  mayCreateCalendar: true,
};

/**
 * Get JMAP Calendar capability limits for the primary account
 */
export function getCalendarCapabilityLimits(): CalendarCapabilityLimits {
  return getAccountCapabilityWithFallback(
    'urn:ietf:params:jmap:calendars',
    DEFAULT_CALENDAR_LIMITS
  );
}

/**
 * JMAP Blob Capability Limits (RFC 9404)
 */
export interface BlobCapabilityLimits {
  /** Maximum size of blob set operation */
  maxSizeBlobSet: number;
  /** Maximum number of data sources in Blob/upload */
  maxDataSources: number;
}

/** Default blob limits */
const DEFAULT_BLOB_LIMITS: BlobCapabilityLimits = {
  maxSizeBlobSet: 7_500_000, // ~7.5MB
  maxDataSources: 16,
};

/**
 * Get JMAP Blob capability limits for the primary account
 */
export function getBlobCapabilityLimits(): BlobCapabilityLimits {
  return getAccountCapabilityWithFallback(
    'urn:ietf:params:jmap:blob',
    DEFAULT_BLOB_LIMITS
  );
}

/**
 * JMAP Contacts Capability Limits (RFC 9610)
 */
export interface ContactsCapabilityLimits {
  /** Can the user create address books */
  mayCreateAddressBook: boolean;
}

/** Default contacts limits */
const DEFAULT_CONTACTS_LIMITS: ContactsCapabilityLimits = {
  mayCreateAddressBook: true,
};

/**
 * Get JMAP Contacts capability limits for the primary account
 */
export function getContactsCapabilityLimits(): ContactsCapabilityLimits {
  return getAccountCapabilityWithFallback(
    'urn:ietf:params:jmap:contacts',
    DEFAULT_CONTACTS_LIMITS
  );
}

/**
 * Chunk an array of IDs into batches respecting maxObjectsInGet
 * This ensures we don't exceed server limits when fetching large numbers of objects
 */
export function chunkForGet<T>(items: T[], maxObjectsInGet?: number): T[][] {
  const limit = maxObjectsInGet ?? getCoreCapabilityLimits().maxObjectsInGet;
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += limit) {
    chunks.push(items.slice(i, i + limit));
  }

  return chunks;
}

/**
 * Chunk an array of items into batches respecting maxObjectsInSet
 * This ensures we don't exceed server limits when updating/deleting large numbers of objects
 */
export function chunkForSet<T>(items: T[], maxObjectsInSet?: number): T[][] {
  const limit = maxObjectsInSet ?? getCoreCapabilityLimits().maxObjectsInSet;
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += limit) {
    chunks.push(items.slice(i, i + limit));
  }

  return chunks;
}

/**
 * Check if the user can create a new top-level mailbox
 * Respects the mayCreateTopLevelMailbox capability
 */
export function canCreateTopLevelMailbox(): boolean {
  return getMailCapabilityLimits().mayCreateTopLevelMailbox;
}

/**
 * Check if the user can create a mailbox at a specific depth
 * Respects the maxMailboxDepth capability
 * @param currentDepth - Current nesting depth (0 for root level)
 */
export function canCreateMailboxAtDepth(currentDepth: number): boolean {
  const limits = getMailCapabilityLimits();

  // No limit set
  if (limits.maxMailboxDepth === null) return true;

  // Check if we're at or below the limit
  return currentDepth < limits.maxMailboxDepth;
}

/**
 * Validate a mailbox name length
 * Respects the maxSizeMailboxName capability
 * @param name - The mailbox name to validate
 * @returns Object with isValid and error message if invalid
 */
export function validateMailboxName(name: string): { isValid: boolean; error?: string } {
  const limits = getMailCapabilityLimits();

  if (!name.trim()) {
    return { isValid: false, error: 'Mailbox name is required' };
  }

  // Check byte length (some servers count bytes, not characters)
  const byteLength = new Blob([name]).size;
  if (byteLength > limits.maxSizeMailboxName) {
    return {
      isValid: false,
      error: `Mailbox name is too long (maximum ${limits.maxSizeMailboxName} bytes)`,
    };
  }

  return { isValid: true };
}

/**
 * Check if a new script can be created
 * Respects the maxNumberScripts capability
 * @param currentScriptCount - Current number of scripts
 */
export function canCreateSieveScript(currentScriptCount: number): boolean {
  const limits = getSieveCapabilityLimits();
  return currentScriptCount < limits.maxNumberScripts;
}

/**
 * Validate a Sieve script size
 * Respects the maxSizeScript capability
 * @param scriptContent - The script content to validate
 * @returns Object with isValid and error message if invalid
 */
export function validateSieveScriptSize(scriptContent: string): { isValid: boolean; error?: string } {
  const limits = getSieveCapabilityLimits();
  const byteLength = new Blob([scriptContent]).size;

  if (byteLength > limits.maxSizeScript) {
    return {
      isValid: false,
      error: `Script is too large (${(byteLength / 1024).toFixed(1)} KB, maximum ${(limits.maxSizeScript / 1024).toFixed(1)} KB)`,
    };
  }

  return { isValid: true };
}

/**
 * Check total attachment size against server limit
 * Respects the maxSizeAttachmentsPerEmail capability
 * @param attachments - Array of attachments with size property
 * @returns Object with isValid, total size, and error if over limit
 */
export function validateAttachmentSize(
  attachments: { size: number }[]
): { isValid: boolean; totalSize: number; error?: string } {
  const limits = getMailCapabilityLimits();
  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

  if (totalSize > limits.maxSizeAttachmentsPerEmail) {
    return {
      isValid: false,
      totalSize,
      error: `Total attachment size (${(totalSize / 1024 / 1024).toFixed(1)} MB) exceeds server limit of ${(limits.maxSizeAttachmentsPerEmail / 1024 / 1024).toFixed(1)} MB`,
    };
  }

  return { isValid: true, totalSize };
}

/**
 * Check if a new calendar can be created
 * Respects the mayCreateCalendar capability
 */
export function canCreateCalendar(): boolean {
  return getCalendarCapabilityLimits().mayCreateCalendar;
}

/**
 * Check if the number of participants is within limits
 * Respects the maxParticipantsPerEvent capability
 * @param participantCount - Number of participants
 */
export function canAddParticipants(participantCount: number): boolean {
  const limits = getCalendarCapabilityLimits();

  // No limit set
  if (limits.maxParticipantsPerEvent === null) return true;

  return participantCount <= limits.maxParticipantsPerEvent;
}

/**
 * Check if a new address book can be created
 * Respects the mayCreateAddressBook capability
 */
export function canCreateAddressBook(): boolean {
  return getContactsCapabilityLimits().mayCreateAddressBook;
}

/**
 * Check if file uploads should be chunked
 * Respects maxSizeBlobSet for blob operations
 * @param fileSize - Size of the file in bytes
 */
export function shouldChunkFileUpload(fileSize: number): boolean {
  const limits = getBlobCapabilityLimits();
  return fileSize > limits.maxSizeBlobSet;
}

/**
 * Validate number of data sources for Blob/upload
 * Respects the maxDataSources capability
 * @param dataSourceCount - Number of data sources
 */
export function validateBlobDataSources(dataSourceCount: number): { isValid: boolean; error?: string } {
  const limits = getBlobCapabilityLimits();

  if (dataSourceCount > limits.maxDataSources) {
    return {
      isValid: false,
      error: `Too many data sources (${dataSourceCount}, maximum ${limits.maxDataSources})`,
    };
  }

  return { isValid: true };
}
