/**
 * useAttachmentDeduplication - Hook for finding and managing duplicate attachments
 * 
 * This hook uses RFC 9404 Blob/lookup to find emails that reference the same blob,
 * enabling attachment deduplication across the mailbox.
 * 
 * Features:
 * - Find duplicate attachments by blobId
 * - View which emails reference each attachment
 * - Calculate storage savings from deduplication
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9404
 */

import { useQuery, useQueries, type UseQueryOptions } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { jmapClient } from '../api/jmap';
import type { Email, EmailBodyPart } from '../types/jmap';
import type { BlobLookupResponse, BlobInfo } from '../types/jmap-blob';

// ============ Types ============

/**
 * Represents a duplicate attachment group
 */
export interface DuplicateAttachmentGroup {
  /** The blobId that is duplicated */
  blobId: string;
  /** The attachment metadata */
  attachment: EmailBodyPart;
  /** Number of emails referencing this blob */
  referenceCount: number;
  /** IDs of emails that reference this blob */
  emailIds: string[];
  /** Total size of this blob */
  size: number;
  /** Potential storage savings if deduplicated */
  potentialSavings: number;
}

/**
 * Result of attachment deduplication analysis
 */
export interface DeduplicationResult {
  /** Groups of duplicate attachments */
  duplicates: DuplicateAttachmentGroup[];
  /** Total number of unique blobs that are duplicated */
  duplicateCount: number;
  /** Total potential storage savings */
  totalPotentialSavings: number;
  /** Total number of redundant references */
  totalRedundantReferences: number;
}

/**
 * Options for attachment deduplication analysis
 */
export interface DeduplicationOptions {
  /** Specific blobIds to analyze (if empty, analyzes all attachments) */
  blobIds?: string[];
  /** Minimum number of references to consider as "duplicate" (default: 2) */
  minReferenceCount?: number;
  /** Maximum number of results to return (default: 100) */
  limit?: number;
  /** Account ID to analyze (defaults to primary account) */
  accountId?: string;
}

// ============ Query Keys ============

const DEDUPLICATION_KEY = 'attachment-deduplication';
const EMAIL_LOOKUP_KEY = 'email-lookup';

// ============ Helper Functions ============

/**
 * Calculate potential storage savings for a duplicate group
 */
function calculatePotentialSavings(size: number, referenceCount: number): number {
  // Savings = size * (referenceCount - 1) since we'd keep one copy
  return size * Math.max(0, referenceCount - 1);
}

/**
 * Group attachments by blobId to find duplicates
 */
function groupAttachmentsByBlobId(emails: Email[]): Map<string, { attachment: EmailBodyPart; emailIds: string[] }> {
  const blobMap = new Map<string, { attachment: EmailBodyPart; emailIds: string[] }>();

  for (const email of emails) {
    if (!email.attachments || email.attachments.length === 0) continue;

    for (const attachment of email.attachments) {
      if (!attachment.blobId) continue;

      const existing = blobMap.get(attachment.blobId);
      if (existing) {
        existing.emailIds.push(email.id);
      } else {
        blobMap.set(attachment.blobId, {
          attachment,
          emailIds: [email.id],
        });
      }
    }
  }

  return blobMap;
}

/**
 * Transform Blob/lookup results into duplicate groups
 */
function transformToDuplicateGroups(
  blobInfos: BlobInfo[],
  attachmentMap: Map<string, EmailBodyPart>
): DuplicateAttachmentGroup[] {
  return blobInfos
    .filter(info => info.matchedIds.Email && info.matchedIds.Email.length > 1)
    .map(info => {
      const emailIds = info.matchedIds.Email || [];
      const attachment = attachmentMap.get(info.id) || {
        blobId: info.id,
        name: 'Unknown',
        type: 'application/octet-stream',
        size: 0,
      };

      return {
        blobId: info.id,
        attachment,
        referenceCount: emailIds.length,
        emailIds,
        size: attachment.size ?? 0,
        potentialSavings: calculatePotentialSavings(attachment.size ?? 0, emailIds.length),
      };
    });
}

// ============ Main Hook ============

/**
 * Hook to analyze attachments for deduplication opportunities
 * 
 * This hook performs the following steps:
 * 1. Fetches emails with attachments (if blobIds not provided)
 * 2. Uses Blob/lookup to find all emails referencing each blob
 * 3. Groups by blobId and identifies duplicates
 * 4. Calculates storage savings potential
 * 
 * @example
 * ```typescript
 * const { data: dedupResult, isLoading } = useAttachmentDeduplication({
 *   minReferenceCount: 2,
 *   limit: 50
 * });
 * 
 * if (dedupResult) {
 *   console.log(`Found ${dedupResult.duplicateCount} duplicates`);
 *   console.log(`Potential savings: ${dedupResult.totalPotentialSavings} bytes`);
 * }
 * ```
 */
export function useAttachmentDeduplication(
  options: DeduplicationOptions = {},
  queryOptions?: Omit<
    UseQueryOptions<DeduplicationResult, Error, DeduplicationResult, [string, string, string[]]>,
    'queryKey' | 'queryFn'
  >
) {
  const {
    blobIds: providedBlobIds,
    minReferenceCount = 2,
    limit = 100,
    accountId: providedAccountId,
  } = options;

  const targetAccountId = providedAccountId ?? jmapClient.getPrimaryAccount();
  const hasBlobCapability = jmapClient.hasBlobCapability();

  return useQuery({
    queryKey: [DEDUPLICATION_KEY, targetAccountId || 'null', providedBlobIds || []],
    queryFn: async (): Promise<DeduplicationResult> => {
      if (!targetAccountId) {
        throw new Error('No account available for deduplication analysis');
      }

      if (!hasBlobCapability) {
        throw new Error('Server does not support RFC 9404 Blob Management');
      }

      // Step 1: Get blobIds to analyze
      let blobIdsToAnalyze: string[];
      let attachmentMap = new Map<string, EmailBodyPart>();

      if (providedBlobIds && providedBlobIds.length > 0) {
        // Use provided blobIds
        blobIdsToAnalyze = providedBlobIds;
      } else {
        // Fetch emails with attachments to find blobIds
        // This is a simplified approach - in production, you might want to
        // paginate through all emails or use a server-side aggregation
        const response = await jmapClient.request([
          [
            'Email/query',
            {
              accountId: targetAccountId,
              filter: { hasAttachment: true },
              limit: 100,
              sort: [{ property: 'receivedAt', isAscending: false }],
            },
            'queryEmails0',
          ],
          [
            'Email/get',
            {
              accountId: targetAccountId,
              '#ids': {
                resultOf: 'queryEmails0',
                name: 'Email/query',
                path: '/ids',
              },
              properties: ['id', 'blobId', 'attachments'],
            },
            'getEmails0',
          ],
        ]);

        const emails = (response.methodResponses[1][1] as { list: Email[] }).list;
        const blobMap = groupAttachmentsByBlobId(emails);
        
        blobIdsToAnalyze = Array.from(blobMap.keys());
        
        // Build attachment map for metadata
        for (const [blobId, data] of blobMap) {
          attachmentMap.set(blobId, data.attachment);
        }
      }

      if (blobIdsToAnalyze.length === 0) {
        return {
          duplicates: [],
          duplicateCount: 0,
          totalPotentialSavings: 0,
          totalRedundantReferences: 0,
        };
      }

      // Step 2: Use Blob/lookup to find all references
      const lookupResponse = await jmapClient.lookupBlobs(
        blobIdsToAnalyze.slice(0, limit),
        ['Email'],
        targetAccountId
      );

      // Step 3: Transform results
      const duplicates = transformToDuplicateGroups(lookupResponse.list, attachmentMap)
        .filter(group => group.referenceCount >= minReferenceCount)
        .sort((a, b) => b.potentialSavings - a.potentialSavings); // Sort by savings potential

      // Step 4: Calculate totals
      const totalPotentialSavings = duplicates.reduce(
        (sum, group) => sum + group.potentialSavings,
        0
      );
      const totalRedundantReferences = duplicates.reduce(
        (sum, group) => sum + (group.referenceCount - 1),
        0
      );

      return {
        duplicates,
        duplicateCount: duplicates.length,
        totalPotentialSavings,
        totalRedundantReferences,
      };
    },
    enabled: !!targetAccountId && hasBlobCapability && (queryOptions?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    ...queryOptions,
  });
}

// ============ Utility Hooks ============

/**
 * Hook to check if a specific attachment is duplicated
 */
export function useIsAttachmentDuplicated(
  blobId: string | undefined,
  accountId?: string
) {
  const targetAccountId = accountId ?? jmapClient.getPrimaryAccount();
  const hasBlobCapability = jmapClient.hasBlobCapability();

  return useQuery({
    queryKey: [EMAIL_LOOKUP_KEY, 'is-duplicated', targetAccountId || 'null', blobId || ''],
    queryFn: async (): Promise<{ isDuplicated: boolean; referenceCount: number }> => {
      if (!blobId || !targetAccountId) {
        return { isDuplicated: false, referenceCount: 0 };
      }

      const response = await jmapClient.lookupBlobs([blobId], ['Email'], targetAccountId);
      const emailIds = response.list[0]?.matchedIds.Email || [];
      const referenceCount = emailIds.length;

      return {
        isDuplicated: referenceCount > 1,
        referenceCount,
      };
    },
    enabled: !!blobId && !!targetAccountId && hasBlobCapability,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to get all emails referencing a specific attachment blob
 */
export function useAttachmentReferences(
  blobId: string | undefined,
  accountId?: string
) {
  const targetAccountId = accountId ?? jmapClient.getPrimaryAccount();
  const hasBlobCapability = jmapClient.hasBlobCapability();

  return useQuery({
    queryKey: [EMAIL_LOOKUP_KEY, 'references', targetAccountId || 'null', blobId || ''],
    queryFn: async (): Promise<Email[]> => {
      if (!blobId || !targetAccountId) {
        return [];
      }

      // First, lookup which emails reference this blob
      const lookupResponse = await jmapClient.lookupBlobs([blobId], ['Email'], targetAccountId);
      const emailIds = lookupResponse.list[0]?.matchedIds.Email || [];

      if (emailIds.length === 0) {
        return [];
      }

      // Then, fetch the email details
      const response = await jmapClient.request([
        [
          'Email/get',
          {
            accountId: targetAccountId,
            ids: emailIds,
            properties: ['id', 'subject', 'from', 'receivedAt', 'preview'],
          },
          'getEmails0',
        ],
      ]);

      return (response.methodResponses[0][1] as { list: Email[] }).list;
    },
    enabled: !!blobId && !!targetAccountId && hasBlobCapability,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to get deduplication statistics for the current account
 */
export function useDeduplicationStats(accountId?: string) {
  const { data, isLoading, error } = useAttachmentDeduplication({ limit: 1000 }, { enabled: !accountId });

  const stats = useMemo(() => {
    if (!data) {
      return {
        duplicateCount: 0,
        totalPotentialSavings: 0,
        totalRedundantReferences: 0,
        averageSavingsPerDuplicate: 0,
        topDuplicates: [] as DuplicateAttachmentGroup[],
      };
    }

    const topDuplicates = data.duplicates.slice(0, 5);
    const averageSavingsPerDuplicate =
      data.duplicateCount > 0 ? data.totalPotentialSavings / data.duplicateCount : 0;

    return {
      duplicateCount: data.duplicateCount,
      totalPotentialSavings: data.totalPotentialSavings,
      totalRedundantReferences: data.totalRedundantReferences,
      averageSavingsPerDuplicate,
      topDuplicates,
    };
  }, [data]);

  return {
    stats,
    isLoading,
    error,
    refetch: () => {}, // Would need to expose from useAttachmentDeduplication
  };
}

// ============ Formatting Utilities ============

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Get deduplication status badge text
 */
export function getDeduplicationStatusText(referenceCount: number): string {
  if (referenceCount === 0) return 'Not referenced';
  if (referenceCount === 1) return 'Unique';
  if (referenceCount <= 3) return `Duplicated (${referenceCount}x)`;
  return `Heavily duplicated (${referenceCount}x)`;
}

/**
 * Get color for deduplication status
 */
export function getDeduplicationStatusColor(referenceCount: number): string {
  if (referenceCount <= 1) return 'var(--icloud-green)';
  if (referenceCount <= 3) return 'var(--icloud-orange)';
  return 'var(--icloud-red)';
}
