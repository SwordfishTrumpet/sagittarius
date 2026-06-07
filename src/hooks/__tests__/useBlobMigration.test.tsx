/**
 * Blob Migration Hook Tests
 * 
 * Tests for useBlobMigration, useMigrationEstimate, and usePrepareAttachmentMigration hooks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useBlobMigration,
  useMigrationEstimate,
  usePrepareAttachmentMigration,
  isMigrationComplete,
  isMigrationSuccessful,
  hasMigrationFailures,
  type BlobMigrationItem,
  type BlobMigrationState,
} from '../useBlobMigration';

// Mock the JMAP client
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    copyBlobs: vi.fn(),
    getPrimaryAccount: () => 'account-001',
  },
}));

import { jmapClient } from '../../api/jmap';

// Test wrapper with QueryClient
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
);

describe('useBlobMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useBlobMigration(), { wrapper: Wrapper });

    expect(result.current.migrationState.status).toBe('idle');
    expect(result.current.migrationState.totalBlobs).toBe(0);
    expect(result.current.migrationState.progress).toBe(0);
    expect(result.current.isPending).toBe(false);
  });

  it('should reset state when resetState is called', async () => {
    const { result } = renderHook(() => useBlobMigration(), { wrapper: Wrapper });

    // Mock successful copy
    vi.mocked(jmapClient.copyBlobs).mockResolvedValueOnce({
      accountId: 'account-002',
      fromAccountId: 'account-001',
      copied: {
        'blob-1': { id: 'new-blob-1', size: 1024 },
      },
    });

    // Execute migration
    await result.current.mutateAsync({
      sourceAccountId: 'account-001',
      targetAccountId: 'account-002',
      blobs: [{ blobId: 'blob-1' }],
    });

    // State should be updated
    await waitFor(() => {
      expect(result.current.migrationState.status).toBe('completed');
    });

    // Reset state
    result.current.resetState();

    // State should be back to idle
    await waitFor(() => {
      expect(result.current.migrationState.status).toBe('idle');
    });
    expect(result.current.migrationState.totalBlobs).toBe(0);
    expect(result.current.migrationState.results).toEqual([]);
  });

  it('should migrate blobs successfully', async () => {
    const { result } = renderHook(() => useBlobMigration(), { wrapper: Wrapper });

    // Mock successful copy response
    vi.mocked(jmapClient.copyBlobs).mockResolvedValueOnce({
      accountId: 'account-002',
      fromAccountId: 'account-001',
      copied: {
        'blob-1': { id: 'new-blob-1', size: 1024 },
        'blob-2': { id: 'new-blob-2', size: 2048 },
      },
    });

    const blobs: BlobMigrationItem[] = [
      { blobId: 'blob-1', name: 'file1.txt', size: 1024 },
      { blobId: 'blob-2', name: 'file2.txt', size: 2048 },
    ];

    const response = await result.current.mutateAsync({
      sourceAccountId: 'account-001',
      targetAccountId: 'account-002',
      blobs,
    });

    // Verify the API was called correctly
    expect(jmapClient.copyBlobs).toHaveBeenCalledWith(
      'account-001',
      ['blob-1', 'blob-2'],
      'account-002'
    );

    // Verify response
    expect(response.success).toBe(true);
    expect(response.summary.total).toBe(2);
    expect(response.summary.successful).toBe(2);
    expect(response.summary.failed).toBe(0);
    expect(response.copied).toHaveLength(2);
    expect(response.failed).toHaveLength(0);

    // Verify state was updated
    await waitFor(() => {
      expect(result.current.migrationState.status).toBe('completed');
      expect(result.current.migrationState.totalBlobs).toBe(2);
      expect(result.current.migrationState.completedBlobs).toBe(2);
      expect(result.current.migrationState.progress).toBe(100);
    });
  });

  it('should handle partial failures', async () => {
    const { result } = renderHook(() => useBlobMigration(), { wrapper: Wrapper });

    // Mock mixed response - one success, one failure
    vi.mocked(jmapClient.copyBlobs).mockResolvedValueOnce({
      accountId: 'account-002',
      fromAccountId: 'account-001',
      copied: {
        'blob-1': { id: 'new-blob-1', size: 1024 },
      },
      notCopied: {
        'blob-2': { type: 'notFound', description: 'Blob not found' },
      },
    });

    const blobs: BlobMigrationItem[] = [
      { blobId: 'blob-1', name: 'file1.txt' },
      { blobId: 'blob-2', name: 'file2.txt' },
    ];

    const response = await result.current.mutateAsync({
      sourceAccountId: 'account-001',
      targetAccountId: 'account-002',
      blobs,
    });

    // Verify response indicates partial success
    expect(response.success).toBe(false);
    expect(response.summary.total).toBe(2);
    expect(response.summary.successful).toBe(1);
    expect(response.summary.failed).toBe(1);
    expect(response.copied).toHaveLength(1);
    expect(response.failed).toHaveLength(1);

    // Verify failed item has error details
    expect(response.failed[0].sourceBlobId).toBe('blob-2');
    expect(response.failed[0].error).toBe('Blob not found');

    // Verify state shows partial status
    await waitFor(() => {
      expect(result.current.migrationState.status).toBe('partial');
      expect(result.current.migrationState.completedBlobs).toBe(1);
      expect(result.current.migrationState.failedBlobs).toBe(1);
    });
  });

  it('should handle complete failures', async () => {
    const { result } = renderHook(() => useBlobMigration(), { wrapper: Wrapper });

    // Mock complete failure response
    vi.mocked(jmapClient.copyBlobs).mockResolvedValueOnce({
      accountId: 'account-002',
      fromAccountId: 'account-001',
      notCopied: {
        'blob-1': { type: 'invalidArguments', description: 'Invalid blob ID' },
        'blob-2': { type: 'invalidArguments', description: 'Invalid blob ID' },
      },
    });

    const blobs: BlobMigrationItem[] = [
      { blobId: 'blob-1' },
      { blobId: 'blob-2' },
    ];

    const response = await result.current.mutateAsync({
      sourceAccountId: 'account-001',
      targetAccountId: 'account-002',
      blobs,
    });

    expect(response.success).toBe(false);
    expect(response.summary.successful).toBe(0);
    expect(response.summary.failed).toBe(2);

    await waitFor(() => {
      expect(result.current.migrationState.status).toBe('failed');
    });
  });

  it('should handle API errors', async () => {
    const { result } = renderHook(() => useBlobMigration(), { wrapper: Wrapper });

    // Mock API error
    vi.mocked(jmapClient.copyBlobs).mockRejectedValueOnce(new Error('Network error'));

    const blobs: BlobMigrationItem[] = [{ blobId: 'blob-1' }];

    await expect(
      result.current.mutateAsync({
        sourceAccountId: 'account-001',
        targetAccountId: 'account-002',
        blobs,
      })
    ).rejects.toThrow('Network error');

    // Verify state shows failure
    await waitFor(() => {
      expect(result.current.migrationState.status).toBe('failed');
      expect(result.current.migrationState.failedBlobs).toBe(1);
    });
  });

  it('should track progress during migration', async () => {
    const { result } = renderHook(() => useBlobMigration(), { wrapper: Wrapper });

    vi.mocked(jmapClient.copyBlobs).mockResolvedValueOnce({
      accountId: 'account-002',
      fromAccountId: 'account-001',
      copied: {
        'blob-1': { id: 'new-blob-1', size: 1024 },
        'blob-2': { id: 'new-blob-2', size: 2048 },
        'blob-3': { id: 'new-blob-3', size: 3072 },
      },
    });

    const progressCallback = vi.fn();
    const blobs: BlobMigrationItem[] = [
      { blobId: 'blob-1' },
      { blobId: 'blob-2' },
      { blobId: 'blob-3' },
    ];

    await result.current.mutateAsync({
      sourceAccountId: 'account-001',
      targetAccountId: 'account-002',
      blobs,
      onProgress: progressCallback,
    });

    // Progress callback should have been called
    expect(progressCallback).toHaveBeenCalled();
  });
});

describe('useMigrationEstimate', () => {
  it('should estimate migration time based on size and count', () => {
    const { result } = renderHook(() => useMigrationEstimate());

    // 1 MB with 1 blob = transfer time (1s) + overhead (0.5s) = ~2s
    const estimate1 = result.current.estimateTime(1024 * 1024, 1);
    expect(estimate1).toBeGreaterThanOrEqual(1);
    expect(estimate1).toBeLessThanOrEqual(3);

    // 10 MB with 5 blobs = transfer time (10s) + overhead (2.5s) = ~13s
    const estimate2 = result.current.estimateTime(10 * 1024 * 1024, 5);
    expect(estimate2).toBeGreaterThanOrEqual(10);
    expect(estimate2).toBeLessThanOrEqual(15);
  });

  it('should format duration correctly', () => {
    const { result } = renderHook(() => useMigrationEstimate());

    // Seconds only
    expect(result.current.formatDuration(30)).toBe('30s');

    // Minutes
    expect(result.current.formatDuration(60)).toBe('1m');
    expect(result.current.formatDuration(90)).toBe('1m 30s');

    // Hours
    expect(result.current.formatDuration(3600)).toBe('1h');
    expect(result.current.formatDuration(3660)).toBe('1h 1m');
    expect(result.current.formatDuration(7200)).toBe('2h');
  });
});

describe('usePrepareAttachmentMigration', () => {
  it('should extract unique blobs from emails', () => {
    const { result } = renderHook(() => usePrepareAttachmentMigration());

    const emails = [
      {
        id: 'email-1',
        attachments: [
          { blobId: 'blob-1', name: 'file1.pdf', size: 1024 },
          { blobId: 'blob-2', name: 'file2.pdf', size: 2048 },
        ],
      },
      {
        id: 'email-2',
        attachments: [
          { blobId: 'blob-2', name: 'file2.pdf', size: 2048 }, // Duplicate
          { blobId: 'blob-3', name: 'file3.pdf', size: 3072 },
        ],
      },
    ];

    const prepared = result.current(emails);

    // Should deduplicate blobs
    expect(prepared.count).toBe(3);
    expect(prepared.blobs).toHaveLength(3);
    expect(prepared.totalSize).toBe(1024 + 2048 + 3072);

    // Verify blob IDs are unique
    const blobIds = prepared.blobs.map(b => b.blobId);
    expect(new Set(blobIds).size).toBe(3);
  });

  it('should handle emails without attachments', () => {
    const { result } = renderHook(() => usePrepareAttachmentMigration());

    const emails = [
      { id: 'email-1', attachments: [] },
      { id: 'email-2' }, // No attachments field
    ];

    const prepared = result.current(emails);

    expect(prepared.count).toBe(0);
    expect(prepared.blobs).toEqual([]);
    expect(prepared.totalSize).toBe(0);
  });

  it('should handle empty email list', () => {
    const { result } = renderHook(() => usePrepareAttachmentMigration());

    const prepared = result.current([]);

    expect(prepared.count).toBe(0);
    expect(prepared.blobs).toEqual([]);
    expect(prepared.totalSize).toBe(0);
  });
});

describe('Migration State Type Guards', () => {
  describe('isMigrationComplete', () => {
    it('should return true for completed, failed, and partial states', () => {
      expect(isMigrationComplete({ status: 'completed' } as unknown as BlobMigrationState)).toBe(true);
      expect(isMigrationComplete({ status: 'failed' } as unknown as BlobMigrationState)).toBe(true);
      expect(isMigrationComplete({ status: 'partial' } as unknown as BlobMigrationState)).toBe(true);
      expect(isMigrationComplete({ status: 'idle' } as unknown as BlobMigrationState)).toBe(false);
      expect(isMigrationComplete({ status: 'migrating' } as unknown as BlobMigrationState)).toBe(false);
    });
  });

  describe('isMigrationSuccessful', () => {
    it('should return true only for completed state', () => {
      expect(isMigrationSuccessful({ status: 'completed' } as unknown as BlobMigrationState)).toBe(true);
      expect(isMigrationSuccessful({ status: 'failed' } as unknown as BlobMigrationState)).toBe(false);
      expect(isMigrationSuccessful({ status: 'partial' } as unknown as BlobMigrationState)).toBe(false);
      expect(isMigrationSuccessful({ status: 'idle' } as unknown as BlobMigrationState)).toBe(false);
    });
  });

  describe('hasMigrationFailures', () => {
    it('should return true for failed and partial states', () => {
      expect(hasMigrationFailures({ status: 'failed' } as unknown as BlobMigrationState)).toBe(true);
      expect(hasMigrationFailures({ status: 'partial' } as unknown as BlobMigrationState)).toBe(true);
      expect(hasMigrationFailures({ status: 'completed' } as unknown as BlobMigrationState)).toBe(false);
      expect(hasMigrationFailures({ status: 'idle' } as unknown as BlobMigrationState)).toBe(false);
    });
  });
});
