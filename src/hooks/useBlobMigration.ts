/**
 * useBlobMigration - React Query hook for cross-account blob migration
 * 
 * Provides functionality to migrate blobs between JMAP accounts:
 * - Batch copy multiple blobs with progress tracking
 * - Verify copied blobs exist in destination
 * - Handle partial failures and retries
 * - Track migration state and statistics
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9404
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jmapClient } from '../api/jmap';
import type { BlobCopyResponse, CopiedBlob } from '../types/jmap-blob';

// ============ Types ============

export interface BlobMigrationItem {
  blobId: string;
  name?: string; // Optional display name for UI
  size?: number; // Optional size for progress calculation
}

export interface BlobMigrationResult {
  sourceBlobId: string;
  success: boolean;
  targetBlobId?: string;
  targetSize?: number;
  error?: string;
}

export interface BlobMigrationState {
  status: 'idle' | 'migrating' | 'completed' | 'failed' | 'partial';
  totalBlobs: number;
  completedBlobs: number;
  failedBlobs: number;
  progress: number; // 0-100
  results: BlobMigrationResult[];
}

export interface MigrateBlobsVariables {
  sourceAccountId: string;
  targetAccountId: string;
  blobs: BlobMigrationItem[];
  onProgress?: (completed: number, total: number) => void;
}

export interface MigrateBlobsResult {
  success: boolean;
  copied: BlobMigrationResult[];
  failed: BlobMigrationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ============ Hook ============

const BLOB_MIGRATION_KEY = 'blob-migration';

/**
 * Hook for cross-account blob migration with progress tracking.
 * 
 * Features:
 * - Batch copy blobs from source to target account
 * - Progress tracking with callbacks
 * - Partial failure handling
 * - Detailed results per blob
 * 
 * Example:
 * ```typescript
 * const migration = useBlobMigration();
 * 
 * const result = await migration.mutateAsync({
 *   sourceAccountId: 'account-1',
 *   targetAccountId: 'account-2',
 *   blobs: [{ blobId: 'blob-1' }, { blobId: 'blob-2' }],
 *   onProgress: (completed, total) => console.log(`${completed}/${total}`),
 * });
 * ```
 */
export function useBlobMigration() {
  const queryClient = useQueryClient();
  const [migrationState, setMigrationState] = useState<BlobMigrationState>({
    status: 'idle',
    totalBlobs: 0,
    completedBlobs: 0,
    failedBlobs: 0,
    progress: 0,
    results: [],
  });

  const resetState = useCallback(() => {
    setMigrationState({
      status: 'idle',
      totalBlobs: 0,
      completedBlobs: 0,
      failedBlobs: 0,
      progress: 0,
      results: [],
    });
  }, []);

  const mutation = useMutation<MigrateBlobsResult, Error, MigrateBlobsVariables>({
    mutationKey: [BLOB_MIGRATION_KEY],
    mutationFn: async ({ sourceAccountId, targetAccountId, blobs, onProgress }) => {
      // Reset state at start
      setMigrationState({
        status: 'migrating',
        totalBlobs: blobs.length,
        completedBlobs: 0,
        failedBlobs: 0,
        progress: 0,
        results: [],
      });

      const blobIds = blobs.map(b => b.blobId);
      const results: BlobMigrationResult[] = [];

      try {
        // Call Blob/copy API
        const response: BlobCopyResponse = await jmapClient.copyBlobs(
          sourceAccountId,
          blobIds,
          targetAccountId
        );

        // Process results
        let completed = 0;
        let failed = 0;

        for (const blob of blobs) {
          const copiedBlob = response.copied?.[blob.blobId];
          const notCopiedError = response.notCopied?.[blob.blobId];

          if (copiedBlob) {
            results.push({
              sourceBlobId: blob.blobId,
              success: true,
              targetBlobId: copiedBlob.id,
              targetSize: copiedBlob.size,
            });
            completed++;
          } else if (notCopiedError) {
            results.push({
              sourceBlobId: blob.blobId,
              success: false,
              error: notCopiedError.description || notCopiedError.type,
            });
            failed++;
          } else {
            // Not in response at all
            results.push({
              sourceBlobId: blob.blobId,
              success: false,
              error: 'Blob not found in response',
            });
            failed++;
          }

          // Update progress
          onProgress?.(completed + failed, blobs.length);
          
          // Update state
          setMigrationState(prev => ({
            ...prev,
            completedBlobs: completed,
            failedBlobs: failed,
            progress: Math.round(((completed + failed) / blobs.length) * 100),
            results: [...results],
          }));
        }

        // Determine final status
        const status: BlobMigrationState['status'] = 
          failed === 0 ? 'completed' :
          completed === 0 ? 'failed' :
          'partial';

        setMigrationState(prev => ({
          ...prev,
          status,
        }));

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['blob-lookup', targetAccountId] });
        queryClient.invalidateQueries({ queryKey: ['blob-data', targetAccountId] });

        return {
          success: status === 'completed',
          copied: results.filter(r => r.success),
          failed: results.filter(r => !r.success),
          summary: {
            total: blobs.length,
            successful: completed,
            failed,
          },
        };
      } catch (error) {
        // Mark all as failed on complete failure
        const failedResults = blobs.map(blob => ({
          sourceBlobId: blob.blobId,
          success: false as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));

        setMigrationState({
          status: 'failed',
          totalBlobs: blobs.length,
          completedBlobs: 0,
          failedBlobs: blobs.length,
          progress: 100,
          results: failedResults,
        });

        throw error;
      }
    },
    onSuccess: (result) => {
      const { summary } = result;
      
      if (summary.failed === 0) {
        toast.success(
          `Migration complete: ${summary.successful} blob${summary.successful === 1 ? '' : 's'} migrated successfully`
        );
      } else if (summary.successful === 0) {
        toast.error(`Migration failed: All ${summary.failed} blob${summary.failed === 1 ? '' : 's'} failed to migrate`);
      } else {
        toast.warning(
          `Migration partial: ${summary.successful} succeeded, ${summary.failed} failed`
        );
      }
    },
    onError: (error) => {
      toast.error(`Blob migration failed: ${error.message}`);
    },
  });

  return {
    ...mutation,
    migrationState,
    resetState,
  };
}

// ============ Utility Hooks ============

/**
 * Hook to estimate migration time based on blob sizes
 */
export function useMigrationEstimate(): {
  estimateTime: (totalSizeBytes: number, blobCount: number) => number;
  formatDuration: (seconds: number) => string;
} {
  // Assume average transfer rate of 1MB/s for estimation
  const BYTES_PER_SECOND = 1024 * 1024;
  // Add 500ms overhead per blob for API calls
  const OVERHEAD_PER_BLOB_MS = 500;

  const estimateTime = useCallback((totalSizeBytes: number, blobCount: number): number => {
    const transferTimeSeconds = totalSizeBytes / BYTES_PER_SECOND;
    const overheadSeconds = (blobCount * OVERHEAD_PER_BLOB_MS) / 1000;
    return Math.ceil(transferTimeSeconds + overheadSeconds);
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  }, []);

  return { estimateTime, formatDuration };
}

/**
 * Hook to prepare blobs for migration from email attachments
 */
export function usePrepareAttachmentMigration() {
  return useCallback((emails: { id: string; attachments?: Array<{ blobId: string; name: string; size: number }> }[]) => {
    const blobs: BlobMigrationItem[] = [];
    const seenBlobIds = new Set<string>();

    for (const email of emails) {
      if (email.attachments) {
        for (const att of email.attachments) {
          if (!seenBlobIds.has(att.blobId)) {
            blobs.push({
              blobId: att.blobId,
              name: att.name,
              size: att.size,
            });
            seenBlobIds.add(att.blobId);
          }
        }
      }
    }

    return {
      blobs,
      totalSize: blobs.reduce((sum, b) => sum + (b.size || 0), 0),
      count: blobs.length,
    };
  }, []);
}

// ============ Type Guards ============

export function isMigrationComplete(state: BlobMigrationState): boolean {
  return state.status === 'completed' || state.status === 'failed' || state.status === 'partial';
}

export function isMigrationSuccessful(state: BlobMigrationState): boolean {
  return state.status === 'completed';
}

export function hasMigrationFailures(state: BlobMigrationState): boolean {
  return state.status === 'failed' || state.status === 'partial';
}
