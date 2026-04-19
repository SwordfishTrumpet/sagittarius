import { useCallback, useMemo } from 'react';
import {
  getCoreCapabilityLimits,
  getMailCapabilityLimits,
  getSieveCapabilityLimits,
  getCalendarCapabilityLimits,
  getBlobCapabilityLimits,
  getContactsCapabilityLimits,
  chunkForGet,
  chunkForSet,
  canCreateTopLevelMailbox,
  canCreateMailboxAtDepth,
  validateMailboxName,
  canCreateSieveScript,
  validateSieveScriptSize,
  validateAttachmentSize,
  canCreateCalendar,
  canAddParticipants,
  canCreateAddressBook,
  shouldChunkFileUpload,
  validateBlobDataSources,
  type CoreCapabilityLimits,
  type MailCapabilityLimits,
  type SieveCapabilityLimits,
  type CalendarCapabilityLimits,
  type BlobCapabilityLimits,
  type ContactsCapabilityLimits,
} from '../utils/capabilityUtils';

/**
 * Hook to access JMAP capability limits with automatic re-computation
 * Returns all capability limits and helper functions
 */
export function useCapabilityLimits() {
  // Core capability limits
  const coreLimits = useMemo<CoreCapabilityLimits>(() => {
    return getCoreCapabilityLimits();
  }, []);

  // Mail capability limits
  const mailLimits = useMemo<MailCapabilityLimits>(() => {
    return getMailCapabilityLimits();
  }, []);

  // Sieve capability limits
  const sieveLimits = useMemo<SieveCapabilityLimits>(() => {
    return getSieveCapabilityLimits();
  }, []);

  // Calendar capability limits
  const calendarLimits = useMemo<CalendarCapabilityLimits>(() => {
    return getCalendarCapabilityLimits();
  }, []);

  // Blob capability limits
  const blobLimits = useMemo<BlobCapabilityLimits>(() => {
    return getBlobCapabilityLimits();
  }, []);

  // Contacts capability limits
  const contactsLimits = useMemo<ContactsCapabilityLimits>(() => {
    return getContactsCapabilityLimits();
  }, []);

  // Chunking helpers
  const chunkIdsForGet = useCallback(<T,>(items: T[]): T[][] => {
    return chunkForGet(items, coreLimits.maxObjectsInGet);
  }, [coreLimits.maxObjectsInGet]);

  const chunkIdsForSet = useCallback(<T,>(items: T[]): T[][] => {
    return chunkForSet(items, coreLimits.maxObjectsInSet);
  }, [coreLimits.maxObjectsInSet]);

  // Mailbox helpers
  const canCreateRootMailbox = useCallback(() => {
    return canCreateTopLevelMailbox();
  }, []);

  const checkMailboxDepth = useCallback((currentDepth: number) => {
    return canCreateMailboxAtDepth(currentDepth);
  }, []);

  const checkMailboxName = useCallback((name: string) => {
    return validateMailboxName(name);
  }, []);

  // Sieve helpers
  const checkCanCreateScript = useCallback((currentCount: number) => {
    return canCreateSieveScript(currentCount);
  }, []);

  const checkScriptSize = useCallback((content: string) => {
    return validateSieveScriptSize(content);
  }, []);

  // Attachment helpers
  const checkAttachmentSize = useCallback((attachments: { size: number }[]) => {
    return validateAttachmentSize(attachments);
  }, []);

  // Calendar helpers
  const checkCanCreateCalendar = useCallback(() => {
    return canCreateCalendar();
  }, []);

  const checkParticipantLimit = useCallback((count: number) => {
    return canAddParticipants(count);
  }, []);

  // Contacts helpers
  const checkCanCreateAddressBook = useCallback(() => {
    return canCreateAddressBook();
  }, []);

  // Blob helpers
  const checkShouldChunkUpload = useCallback((fileSize: number) => {
    return shouldChunkFileUpload(fileSize);
  }, []);

  const checkBlobDataSources = useCallback((count: number) => {
    return validateBlobDataSources(count);
  }, []);

  return {
    // Raw limits
    coreLimits,
    mailLimits,
    sieveLimits,
    calendarLimits,
    blobLimits,
    contactsLimits,

    // Chunking helpers
    chunkIdsForGet,
    chunkIdsForSet,

    // Validation helpers
    canCreateRootMailbox,
    checkMailboxDepth,
    checkMailboxName,
    checkCanCreateScript,
    checkScriptSize,
    checkAttachmentSize,
    checkCanCreateCalendar,
    checkParticipantLimit,
    checkCanCreateAddressBook,
    checkShouldChunkUpload,
    checkBlobDataSources,
  };
}

/**
 * Hook specifically for email mutation batching limits
 * Returns chunked versions of bulk operations
 */
export function useEmailBatchingLimits() {
  const { chunkIdsForSet } = useCapabilityLimits();

  /**
   * Chunk email IDs for bulk operations
   * Ensures we don't exceed maxObjectsInSet
   */
  const chunkEmailIds = useCallback((emailIds: string[]): string[][] => {
    return chunkIdsForSet(emailIds);
  }, [chunkIdsForSet]);

  /**
   * Get the maximum number of emails that can be processed in one request
   */
  const maxBatchSize = useMemo(() => {
    return getCoreCapabilityLimits().maxObjectsInSet;
  }, []);

  return {
    chunkEmailIds,
    maxBatchSize,
  };
}

/**
 * Hook specifically for attachment size limits
 */
export function useAttachmentLimits() {
  const { mailLimits, checkAttachmentSize } = useCapabilityLimits();

  /**
   * Maximum total attachment size in bytes
   */
  const maxTotalSize = mailLimits.maxSizeAttachmentsPerEmail;

  /**
   * Maximum total attachment size in MB (for display)
   */
  const maxTotalSizeMB = useMemo(() => {
    return Math.floor(mailLimits.maxSizeAttachmentsPerEmail / 1024 / 1024);
  }, [mailLimits.maxSizeAttachmentsPerEmail]);

  /**
   * Validate attachments against server limit
   */
  const validateAttachments = useCallback((attachments: { size: number }[]) => {
    return checkAttachmentSize(attachments);
  }, [checkAttachmentSize]);

  /**
   * Check if adding another attachment would exceed the limit
   */
  const canAddAttachment = useCallback(
    (currentAttachments: { size: number }[], newAttachmentSize: number) => {
      const currentTotal = currentAttachments.reduce((sum, a) => sum + a.size, 0);
      return currentTotal + newAttachmentSize <= maxTotalSize;
    },
    [maxTotalSize]
  );

  /**
   * Get remaining attachment size budget
   */
  const getRemainingSize = useCallback(
    (currentAttachments: { size: number }[]) => {
      const currentTotal = currentAttachments.reduce((sum, a) => sum + a.size, 0);
      return Math.max(0, maxTotalSize - currentTotal);
    },
    [maxTotalSize]
  );

  return {
    maxTotalSize,
    maxTotalSizeMB,
    validateAttachments,
    canAddAttachment,
    getRemainingSize,
  };
}

/**
 * Hook specifically for mailbox creation limits
 */
export function useMailboxCreationLimits() {
  const { mailLimits, canCreateRootMailbox, checkMailboxDepth, checkMailboxName } = useCapabilityLimits();

  /**
   * Whether the user can create top-level mailboxes
   */
  const canCreateTopLevel = useMemo(() => {
    return mailLimits.mayCreateTopLevelMailbox;
  }, [mailLimits.mayCreateTopLevelMailbox]);

  /**
   * Maximum depth of mailbox hierarchy (null = unlimited)
   */
  const maxDepth = mailLimits.maxMailboxDepth;

  /**
   * Maximum mailbox name length in bytes
   */
  const maxNameLength = mailLimits.maxSizeMailboxName;

  /**
   * Check if a mailbox can be created at the given depth
   */
  const canCreateAtDepth = useCallback(
    (currentDepth: number) => {
      return checkMailboxDepth(currentDepth);
    },
    [checkMailboxDepth]
  );

  /**
   * Validate a mailbox name
   */
  const validateName = useCallback(
    (name: string) => {
      return checkMailboxName(name);
    },
    [checkMailboxName]
  );

  /**
   * Get depth status message (for UI display)
   */
  const getDepthStatus = useCallback(
    (currentDepth: number): { canCreate: boolean; message?: string } => {
      if (maxDepth === null) {
        return { canCreate: true };
      }

      if (currentDepth >= maxDepth) {
        return {
          canCreate: false,
          message: `Maximum folder depth reached (${maxDepth} levels)`,
        };
      }

      const remaining = maxDepth - currentDepth;
      return {
        canCreate: true,
        message: remaining === 1 ? '1 level remaining' : `${remaining} levels remaining`,
      };
    },
    [maxDepth]
  );

  return {
    canCreateTopLevel,
    maxDepth,
    maxNameLength,
    canCreateAtDepth,
    validateName,
    getDepthStatus,
  };
}

/**
 * Hook specifically for Sieve filter limits
 */
export function useSieveLimits() {
  const { sieveLimits, checkCanCreateScript, checkScriptSize } = useCapabilityLimits();

  /**
   * Maximum number of Sieve scripts allowed
   */
  const maxScripts = sieveLimits.maxNumberScripts;

  /**
   * Maximum size of a Sieve script in bytes
   */
  const maxScriptSize = sieveLimits.maxSizeScript;

  /**
   * Maximum size in KB (for display)
   */
  const maxScriptSizeKB = useMemo(() => {
    return Math.floor(sieveLimits.maxSizeScript / 1024);
  }, [sieveLimits.maxSizeScript]);

  /**
   * Check if a new script can be created
   */
  const canCreateScript = useCallback(
    (currentCount: number) => {
      return checkCanCreateScript(currentCount);
    },
    [checkCanCreateScript]
  );

  /**
   * Validate script size
   */
  const validateScript = useCallback(
    (content: string) => {
      return checkScriptSize(content);
    },
    [checkScriptSize]
  );

  return {
    maxScripts,
    maxScriptSize,
    maxScriptSizeKB,
    canCreateScript,
    validateScript,
  };
}

/**
 * Hook specifically for calendar limits
 */
export function useCalendarLimits() {
  const { calendarLimits, checkCanCreateCalendar, checkParticipantLimit } = useCapabilityLimits();

  /**
   * Whether the user can create calendars
   */
  const canCreate = useMemo(() => {
    return calendarLimits.mayCreateCalendar;
  }, [calendarLimits.mayCreateCalendar]);

  /**
   * Maximum participants per event (null = unlimited)
   */
  const maxParticipants = calendarLimits.maxParticipantsPerEvent;

  /**
   * Check if more participants can be added
   */
  const canAddMoreParticipants = useCallback(
    (currentCount: number) => {
      return checkParticipantLimit(currentCount);
    },
    [checkParticipantLimit]
  );

  return {
    canCreate,
    maxParticipants,
    canAddMoreParticipants,
  };
}

/**
 * Hook specifically for contacts/address book limits
 */
export function useContactsLimits() {
  const { checkCanCreateAddressBook } = useCapabilityLimits();

  /**
   * Whether the user can create address books
   */
  const canCreateAddressBook = useCallback(() => {
    return checkCanCreateAddressBook();
  }, [checkCanCreateAddressBook]);

  return {
    canCreateAddressBook,
  };
}
